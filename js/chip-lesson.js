// These two stops share the tour's actual prompt, prediction and example token IDs.
const lesson = document.getElementById('chipLesson');

function node(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function flowArrow() {
  const arrow = node('i', 'chip-arrow');
  arrow.setAttribute('aria-hidden', 'true');
  return arrow;
}

function chipDiagram(ui) {
  const copy = ui.chipLesson;
  const flow = node('div', 'chip-flow');
  const prompt = node('div', 'chip-prompt');
  prompt.append(node('span', 'chip-label', copy.prompt));
  const quote = node('p', 'chip-quote');
  ui.promptLines.forEach((line, i) => {
    if (i) quote.append(' ');
    quote.append(node('span', '', line));
  });
  prompt.append(quote);

  const process = node('div', 'chip-process');
  const housing = node('div', 'chip-package');
  housing.setAttribute('aria-hidden', 'true');
  const face = node('div', 'chip-face');
  face.append(node('span', 'chip-engraving', ui.labels.gpu));
  const die = node('div', 'chip-die');
  for (let i = 0; i < 6; i++) die.append(node('i', 'chip-core'));
  face.append(die);
  housing.append(face);
  process.append(housing, node('strong', 'chip-sr', ui.labels.gpu), node('span', 'chip-process-caption', copy.lane));

  const result = node('div', 'chip-result');
  result.append(node('span', 'chip-label', copy.next), node('strong', 'chip-prediction', ui.choices[0].word));
  flow.append(prompt, flowArrow(), process, flowArrow(), result);
  return flow;
}

function tokenDiagram(ui) {
  const copy = ui.chipLesson;
  const diagram = node('div', 'token-diagram');
  const pieces = node('div', 'token-pieces');
  pieces.setAttribute('role', 'group');
  pieces.setAttribute('aria-label', copy.pieces);
  const ticket = node('div', 'token-ticket');
  ticket.setAttribute('aria-live', 'polite');
  ticket.setAttribute('aria-atomic', 'true');
  const word = node('strong', 'token-value');
  const id = node('strong', 'token-number');
  const pair = (label, value) => {
    const part = node('div', 'token-field');
    part.append(node('span', 'chip-label', label), value);
    return part;
  };
  ticket.append(pair(copy.piece, word), flowArrow(), pair(copy.id, id));

  const buttons = ui.tokens.map((token, i) => {
    const button = node('button', 'token-key', token.word);
    button.type = 'button';
    button.addEventListener('click', () => select(i));
    pieces.append(button);
    return button;
  });
  function select(index) {
    const token = ui.tokens[index];
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    word.textContent = token.word;
    id.textContent = token.id;
  }
  select(3); // Start with the country from the preceding GPU example.
  diagram.append(node('span', 'chip-label', copy.pieces), pieces, ticket);
  return diagram;
}

export function showChipLesson(ui, mode) {
  lesson.replaceChildren(mode === 'gpu' ? chipDiagram(ui) : tokenDiagram(ui));
  lesson.hidden = false;
  document.body.classList.add('chip-lesson-open');
}

export function hideChipLesson() {
  lesson.hidden = true;
  document.body.classList.remove('chip-lesson-open');
}
