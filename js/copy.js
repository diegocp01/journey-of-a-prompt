/* All on-screen text, in English and Spanish. */
export const appCopy={
  en:{
    htmlLang:"en",documentTitle:"Journey of a Prompt",brand:"Journey of a prompt",timerLabel:"real time",
    kicker:(i,n,name)=>`Stop ${i} of ${n} · ${name}`,
    next:"Next stop →",nextStep:"Next",back:"Go back one step",
    cont:"Continue",again:"Do it again",stepOf:(i,n)=>`Step ${i} of ${n}`,ready:l=>`Take your time. Tap “${l}” when you are ready.`,slow:"Slow",fast:"Fast",auto:"Auto",autoOn:"Auto-play is on: it moves on by itself. Tap to pause.",autoOff:"Auto-play: let it move on by itself",
    replay:"See the whole trip ▸",restart:"↺ Start over",
    replayDone:"That was real speed: about <b>one second</b>. No country and no company owns the internet. It is billions of machines that agree to pass a stranger's message along.",
    promptLines:["The capital of","France is..."],prompt:"The capital of France is",
    answer:["Paris,","the","City","of","Light."],
    labels:{phoneTitle:"ChatGPT",ask:"Ask anything",message:"Message",wifi:"Wi-Fi router",tower:"Cell tower",router:"router",fiber:"glass fiber cable",sea:"Ocean floor|13,000 feet deep",speed:"450 million mph",you:"You",far:"The AI's data center",dcs:"Data center",to:"To",
      dc:"DATA CENTER",dnsTitle:"The internet's address book",guard:"Security check",checking:"Checking…",ok:"✓ It's you",director:"Traffic director",busy:"busy",free:"free",gpu:"GPU",hair:"a human hair, for size",glass:"one glass thread"},
    stops:[
      {name:"Your phone",title:"It starts with Send",say:"Tap the blue <b>Send</b> button.",action:"Send ↑",
       beats:[["Words become numbers",["Computers only understand <b>1s and 0s</b>.","Every letter becomes <b>eight</b> of them.",["216","ones and zeros for one short question"]]],
              ["Locked with a key",["Your phone <b>scrambles</b> the numbers.","On the way, nobody can read them.","Sealed. <b>Follow the envelope.</b>"]]]},
      {name:"Through the air",title:"No wire attached",say:"So how does your message get out?",action:"Send it out",
       beats:[["Radio waves",["It flies through the air as invisible <b>radio waves</b>.","A <b>cell tower</b> catches them. At home, your Wi-Fi does.","The tower turns them into <b>light</b> in a glass cable."]]]},
      {name:"The internet",title:"The long trip",say:"The AI lives far away, maybe in <b>another state</b>.",action:"Start the trip",
       beats:[["First, the address",["An address book turns the name into a <b>number</b>.","No machine knows the whole route.","Each one just passes it <b>closer</b>."]],
              ["It travels as light",["Through glass threads as thin as a <b>hair</b>.",["124,000 miles","every second. Five laps around the Earth."]]],
              ["Under the ocean",["To reach other continents, cables cross the <b>sea floor</b>.","Each is as thick as a <b>garden hose</b>.",["600 cables","carry almost all the world's data. Not satellites."]]]]},
      {name:"Data center",title:"The data center",say:"A giant building of computers that <b>never sleep</b>.",action:"Go inside",
       beats:[["The front door",["A check: is it <b>really you</b>?","Only now is the envelope <b>unlocked</b>."]],
              ["Where the AI lives",["Rows of chips called <b>GPUs</b>.","The AI is <b>billions of numbers</b> stored on them.","Your words go in. The math begins."]]]},
      {name:"Inside the AI"},
      {name:"Trip home",title:"The answer is back",say:"The whole answer, in <b>one piece</b>.",action:"Open it",
       beats:[["All at once",["Unlocked on your phone, only for you.","The whole answer appears <b>at once</b>."]]]}
    ],
    finale:["The whole trip",[["20 seconds","from Send to answer. Almost all of it is the AI thinking."],"In 1858, the first ocean cable needed <b>16 hours</b> for 98 words.","Nobody owns the internet. Billions of machines just pass it on."]],
    subs:[
      {name:"Split",title:"Cut into pieces",say:"Each piece of text gets an <b>ID number</b>."},
      {name:"Meaning",title:"Give each piece meaning",say:"A list of numbers, like a <b>fingerprint</b>. Tap a word."},
      {name:"Links",title:"Words look at each other",say:"Thicker line, stronger <b>link</b>. Tap a word."},
      {name:"Next word",title:"Score the next word",say:"Every possible word gets a <b>score</b>."},
      {name:"Loop",title:"Add it. Go again.",say:"One word at a time, over and over."}
    ],
    tokenId:id=>`ID ${id}`,place:i=>`place ${i}`,
    fpInfo:t=>`<b>${t.word}</b>: ${t.meaning}`,
    attention:(w,l)=>`<b>${w}</b> ${l}`,
    winner:"<b>Paris</b> scores highest, so it is added.",
    pass:(i,c,w)=>`“${c}” → <b>${w}</b>`,
    choices:[{word:"Paris",percent:92,color:"#ffb545"},{word:"Lyon",percent:3,color:"#55a7ff"},{word:"Marseille",percent:2,color:"#b685ff"},{word:"Berlin",percent:1,color:"#28d7bd"},{word:"the",percent:1,color:"#ff6f91"}],
    tokens:[
      {word:"The",id:464,color:"#76d5c2",kind:"pointer word",meaning:"It says a specific thing is coming."},
      {word:"capital",id:3797,color:"#f6bd60",kind:"idea word",meaning:"It leans toward city, government and country."},
      {word:"of",id:286,color:"#7fb3ff",kind:"connector",meaning:"It says the capital belongs to something."},
      {word:"France",id:4942,color:"#8fd17f",kind:"place name",meaning:"It points to a country in Europe and facts about it."},
      {word:"is",id:374,color:"#bda7f2",kind:"helper verb",meaning:"It signals that the next word completes a fact."}
    ],
    relations:[
      {label:"sets up that a specific thing is coming.",lines:[{to:1,w:6},{to:3,w:3},{to:4,w:2}]},
      {label:"links hard to France: a capital needs a country.",lines:[{to:3,w:11},{to:2,w:6},{to:4,w:5},{to:0,w:3}]},
      {label:"is the bridge between capital and France.",lines:[{to:1,w:9},{to:3,w:9},{to:4,w:3}]},
      {label:"looks back at capital and ahead to is.",lines:[{to:1,w:11},{to:4,w:7},{to:2,w:5},{to:0,w:2}]},
      {label:"leans on France and capital to guess what comes next.",lines:[{to:3,w:12},{to:1,w:9},{to:2,w:5},{to:0,w:4}]}
    ]
  },
  es:{
    htmlLang:"es",documentTitle:"El viaje de un prompt",brand:"El viaje de un prompt",timerLabel:"tiempo real",
    kicker:(i,n,name)=>`Parada ${i} de ${n} · ${name}`,
    next:"Siguiente parada →",nextStep:"Sigue",back:"Volver un paso",
    cont:"Continuar",again:"Otra vez",stepOf:(i,n)=>`Paso ${i} de ${n}`,ready:l=>`Sin prisa. Toca “${l}” cuando quieras seguir.`,slow:"Lento",fast:"Rápido",auto:"Auto",autoOn:"Modo automático activo: avanza solo. Toca para pausar.",autoOff:"Modo automático: que avance solo",
    replay:"Ver todo el viaje ▸",restart:"↺ Empezar de nuevo",
    replayDone:"Esa fue la velocidad real: cerca de <b>un segundo</b>. Ningún país ni empresa es dueño de internet. Son miles de millones de máquinas que acuerdan pasar el mensaje de un desconocido.",
    promptLines:["La capital de","Francia es..."],prompt:"La capital de Francia es",
    answer:["París,","la","Ciudad","de","la","Luz."],
    labels:{phoneTitle:"ChatGPT",ask:"Pregunta lo que quieras",message:"Mensaje",wifi:"Router Wi-Fi",tower:"Antena celular",router:"router",fiber:"cable de fibra de vidrio",sea:"Fondo del océano|13,000 pies de profundidad",speed:"450 millones de mph",you:"Tú",far:"Centro de datos de la IA",dcs:"Centro de datos",to:"Para",
      dc:"CENTRO DE DATOS",dnsTitle:"El directorio de internet",guard:"Control de seguridad",checking:"Revisando…",ok:"✓ Eres tú",director:"Director de tráfico",busy:"ocupado",free:"libre",gpu:"GPU",hair:"un cabello, para comparar",glass:"un hilo de vidrio"},
    stops:[
      {name:"Tu teléfono",title:"Todo empieza con Enviar",say:"Toca el botón azul de <b>Enviar</b>.",action:"Enviar ↑",
       beats:[["Las palabras se vuelven números",["Las computadoras solo entienden <b>unos y ceros</b>.","Cada letra se convierte en <b>ocho</b> de ellos.",["216","unos y ceros para una pregunta corta"]]],
              ["Cerrado con llave",["Tu teléfono <b>mezcla</b> los números.","En el camino, nadie puede leerlos.","Sellado. <b>Sigue el sobre.</b>"]]]},
      {name:"Por el aire",title:"Sin ningún cable",say:"Entonces, ¿cómo sale tu mensaje?",action:"Enviarlo",
       beats:[["Ondas de radio",["Vuela por el aire como <b>ondas de radio</b> invisibles.","Una <b>antena celular</b> las atrapa. En casa, lo hace tu Wi-Fi.","La antena las convierte en <b>luz</b> dentro de un cable de vidrio."]]]},
      {name:"Internet",title:"El viaje largo",say:"La IA vive lejos, quizá en <b>otro estado</b>.",action:"Empezar el viaje",
       beats:[["Primero, la dirección",["Un directorio convierte el nombre en un <b>número</b>.","Ninguna máquina conoce la ruta completa.","Cada una solo lo pasa <b>más cerca</b>."]],
              ["Viaja como luz",["Por hilos de vidrio tan finos como un <b>cabello</b>.",["124,000 millas","cada segundo. Cinco vueltas a la Tierra."]]],
              ["Bajo el océano",["Para llegar a otros continentes, los cables cruzan el <b>fondo del mar</b>.","Cada uno es tan grueso como una <b>manguera</b>.",["600 cables","llevan casi todos los datos del mundo. No los satélites."]]]]},
      {name:"Centro de datos",title:"El centro de datos",say:"Un edificio gigante de computadoras que <b>nunca duermen</b>.",action:"Entrar",
       beats:[["La puerta de entrada",["Un control: ¿<b>de verdad eres tú</b>?","Solo ahora se <b>abre</b> el sobre."]],
              ["Donde vive la IA",["Filas de chips llamados <b>GPU</b>.","La IA son <b>miles de millones de números</b> guardados en ellos.","Tus palabras entran. Empiezan las cuentas."]]]},
      {name:"Dentro de la IA"},
      {name:"Viaje de regreso",title:"La respuesta está de vuelta",say:"La respuesta completa, en <b>una sola pieza</b>.",action:"Abrirla",
       beats:[["Toda de una vez",["Se abre en tu teléfono, solo para ti.","La respuesta completa aparece <b>de una vez</b>."]]]}
    ],
    finale:["Todo el viaje",[["20 segundos","de Enviar a la respuesta. Casi todo es la IA pensando."],"En 1858, el primer cable oceánico necesitó <b>16 horas</b> para 98 palabras.","Nadie es dueño de internet. Miles de millones de máquinas solo lo pasan."]],
    subs:[
      {name:"Separar",title:"Cortar en piezas",say:"Cada pieza de texto recibe un <b>número de ID</b>."},
      {name:"Significado",title:"Dar significado a cada pieza",say:"Una lista de números, como una <b>huella digital</b>. Toca una palabra."},
      {name:"Conexiones",title:"Las palabras se miran",say:"Línea más gruesa, <b>conexión</b> más fuerte. Toca una palabra."},
      {name:"Siguiente palabra",title:"Puntuar la siguiente palabra",say:"Cada palabra posible recibe un <b>puntaje</b>."},
      {name:"Bucle",title:"Agregarla. Otra vez.",say:"Una palabra a la vez, una y otra vez."}
    ],
    tokenId:id=>`ID ${id}`,place:i=>`lugar ${i}`,
    fpInfo:t=>`<b>${t.word}</b>: ${t.meaning}`,
    attention:(w,l)=>`<b>${w}</b> ${l}`,
    winner:"<b>París</b> tiene el puntaje más alto, así que se agrega.",
    pass:(i,c,w)=>`“${c}” → <b>${w}</b>`,
    choices:[{word:"París",percent:92,color:"#ffb545"},{word:"Lyon",percent:3,color:"#55a7ff"},{word:"Marsella",percent:2,color:"#b685ff"},{word:"Berlín",percent:1,color:"#28d7bd"},{word:"la",percent:1,color:"#ff6f91"}],
    tokens:[
      {word:"La",id:464,color:"#76d5c2",kind:"palabra que señala",meaning:"Avisa que viene una cosa específica."},
      {word:"capital",id:3797,color:"#f6bd60",kind:"palabra de idea",meaning:"Apunta a ciudad, gobierno y país."},
      {word:"de",id:286,color:"#7fb3ff",kind:"conector",meaning:"Dice que la capital pertenece a algo."},
      {word:"Francia",id:4942,color:"#8fd17f",kind:"nombre de lugar",meaning:"Apunta a un país de Europa y a datos sobre él."},
      {word:"es",id:374,color:"#bda7f2",kind:"verbo de ayuda",meaning:"Avisa que la siguiente palabra completa un dato."}
    ],
    relations:[
      {label:"avisa que viene una cosa específica.",lines:[{to:1,w:6},{to:3,w:3},{to:4,w:2}]},
      {label:"se une fuerte a Francia: una capital necesita un país.",lines:[{to:3,w:11},{to:2,w:6},{to:4,w:5},{to:0,w:3}]},
      {label:"es el puente entre capital y Francia.",lines:[{to:1,w:9},{to:3,w:9},{to:4,w:3}]},
      {label:"mira hacia capital y hacia es.",lines:[{to:1,w:11},{to:4,w:7},{to:2,w:5},{to:0,w:2}]},
      {label:"se apoya en Francia y capital para adivinar lo que sigue.",lines:[{to:3,w:12},{to:1,w:9},{to:2,w:5},{to:0,w:4}]}
    ]
  }
};
