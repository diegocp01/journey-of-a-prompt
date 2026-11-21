// Each distance index buffer references the original scan's positions, UVs,
// normals and materials. meshoptimizer reduces the two index streams to 27%
// and 7% with UV/normal error bounds. Verify the source topology before use.
import * as THREE from 'three';

const stands=[];
let previousScale=0,previousWindow=false;
const previousEye=new THREE.Vector3(Infinity,Infinity,Infinity);

const indexData=fetch(new URL('../assets/land/scan-detail.bin',import.meta.url))
  .then(async response=>{
    if(!response.ok) return {};
    const bytes=await response.arrayBuffer();
    const view=new DataView(bytes);
    if(view.getUint32(0)!==0x4a4c4431) return {}; // JLD1
    const headerSize=view.getUint32(4,true);
    const records=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,8,headerSize)));
    let offset=8+headerSize;
    return Object.fromEntries(Object.entries(records).map(([name,[vertices,indices,hash,...lengths]])=>{
      const levels=lengths.map(length=>{
        const array=new Uint16Array(bytes,offset,length);
        offset+=array.byteLength;
        return array;
      });
      return [name,{vertices,indices,hash,levels}];
    }));
  }).catch(()=>({}));

function topologySignature(geometry){
  let hash=2166136261;
  const input=geometry.index.array,pos=geometry.attributes.position;
  for(const value of input) hash=Math.imul(hash^value,16777619);
  for(let i=0;i<pos.count;i++){
    hash=Math.imul(hash^Math.round(pos.getX(i)*65536),16777619);
    hash=Math.imul(hash^Math.round(pos.getY(i)*65536),16777619);
    hash=Math.imul(hash^Math.round(pos.getZ(i)*65536),16777619);
  }
  return hash>>>0;
}

export async function registerScan(name,geometry,batches){
  const entry=(await indexData)[name];
  if(!entry || !geometry.index || geometry.attributes.position.count!==entry.vertices ||
    geometry.index.count!==entry.indices || topologySignature(geometry)!==entry.hash) return;
  const levels=[geometry,...entry.levels.map(indices=>{
    const simplified=new THREE.BufferGeometry();
    for(const [key,attr] of Object.entries(geometry.attributes)) simplified.setAttribute(key,attr);
    simplified.setIndex(new THREE.BufferAttribute(indices,1));
    simplified.boundingSphere=geometry.boundingSphere;
    simplified.boundingBox=geometry.boundingBox;
    return simplified;
  })];
  for(const {mesh,diameter} of batches){
    mesh.computeBoundingBox();
    stands.push({mesh,diameter,levels});
  }
  previousScale=0;
}

// The near desk camera looks east through the 1.5m window. Clip stands only
// when the wall hides their entire box and sunlight from the tall side of
// the stand passes below the desk before reaching this room.
function hiddenByOfficeWall(bounds,eye){
  if(bounds.min.x<5 || bounds.max.y>=.6+.32*(bounds.min.x-2))return false;
  const toFacade=2.04-eye.x;
  const near=(bounds.min.x-eye.x)/toFacade,far=(bounds.max.x-eye.x)/toFacade;
  const sill=(1.02-eye.y),left=(-.76-eye.z),right=(.76-eye.z);
  return bounds.max.y<eye.y+sill*(sill>=0?near:far)
    || bounds.max.z<eye.z+left*(left>=0?near:far)
    || bounds.min.z>eye.z+right*(right>=0?far:near);
}

export function updateScans(camera,height,inOffice){
  // On these ground-level routes camera position is already in world
  // coordinates. The nearest edge of the stand keeps its largest member sharp.
  const scale=height/(2*Math.tan(camera.fov*Math.PI/360));
  const throughWindow=inOffice && camera.position.x<1.7 && Math.abs(camera.position.z)<1.8;
  if(throughWindow===previousWindow && Math.abs(scale-previousScale)<.01 && previousEye.distanceToSquared(camera.position)<.04)return;
  previousWindow=throughWindow;
  previousScale=scale;previousEye.copy(camera.position);
  for(const {mesh,diameter,levels} of stands){
    mesh.visible=!throughWindow || !hiddenByOfficeWall(mesh.boundingBox,camera.position);
    if(!mesh.visible)continue;
    const bounds=mesh.boundingSphere;
    const near=Math.max(.1,camera.position.distanceTo(bounds.center)-bounds.radius);
    const pixels=diameter*scale/near;
    mesh.geometry=levels[pixels>80?0:pixels>24?1:2];
  }
}
