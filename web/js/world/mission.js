import { renderMethod } from './method.js';

const node = (tag, text, cls) => { const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el; };
const references = {
  fire: ['NASA: Fire safety in space', 'https://microdevices.jpl.nasa.gov/capabilities/in-situ-instruments-tls/spacecraft-fire/'],
  saffire: ['NASA: The Saffire experiments', 'https://www.nasa.gov/centers-and-facilities/glenn/flame-burns-out-on-nasas-long-running-spacecraft-fire-experiment/'],
  astrobee: ['NASA: Astrobee robotics', 'https://www.nasa.gov/directorates/stmd/astrobee/'],
  operations: ['NASA: Lessons from Astrobee operations', 'https://ntrs.nasa.gov/citations/20240009306']
};
export const STATION_AGENTS = {
  transit: 'Mission guide', flame: 'Flame explainer', evidence: 'Evidence analyst',
  drill: 'Mission officer', trust: 'Evidence verifier', robotics: 'Robotics coordinator'
};

export function createMissionBrief({ navigate, run }) {
  const dialog = node('dialog', null, 'mission-brief'); dialog.setAttribute('aria-labelledby', 'mission-heading');
  const header = node('header'), title = node('h2', 'Why VESTA'); title.id = 'mission-heading';
  const close = node('button', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close mission brief');
  header.append(title, close);
  const nav = node('nav'); nav.setAttribute('aria-label', 'Mission brief topics');
  const body = node('div', null, 'mission-body'); let trigger;
  const tabs = new Map();
  for (const [id, label] of [['problem','The problem'],['method','Method & limits'],['agents','The agents'],['robotics','Space robotics']]) {
    const button = node('button', label); button.type='button'; button.onclick=()=>show(id); tabs.set(id,button); nav.append(button);
  }
  dialog.append(header, nav, body); document.body.append(dialog);
  const link = key => { const [label, href] = references[key], a=node('a',label); a.href=href; a.target='_blank'; a.rel='noopener'; return a; };
  const action = (label, station, task) => { const button=node('button',label,'mission-action'); button.type='button'; button.onclick=()=>{dialog.close();navigate(station);if(task)run(station,task);}; return button; };
  function show(tab) {
    tabs.forEach((button,id)=>button.setAttribute('aria-current',id===tab?'page':'false'));
    body.replaceChildren(); title.textContent=({problem:'A real problem. A useful next step.',method:'How to evaluate the evidence.',agents:'Meet the evidence team.',robotics:'From evidence to space robotics.'})[tab] ?? 'Why VESTA';
    if(tab==='problem') {
      body.append(node('p','Fire in a spacecraft puts the crew inside the hazard. Understanding it requires evidence from the conditions where people will live.','mission-lead'));
      const grid=node('div',null,'mission-facts');
      for(const [number,heading,text,key] of [
        ['01','Fire behaves differently','NASA studies flame growth, combustion gases and material flammability in microgravity. Large fire experiments are carried out aboard uncrewed cargo vehicles.','fire'],
        ['02','Testing has limits','Crew safety limits what can be tested aboard an occupied spacecraft. Saffire helps researchers study larger fires without putting astronauts beside them.','saffire'],
        ['03','Evidence must reach the decision','VESTA links a chosen cabin to source rows and findings, makes gaps visible, and lets people rehearse an evidence-linked drill.',null]
      ]) { const card=node('article');card.append(node('h3',heading),node('p',text));if(key)card.append(link(key));grid.append(card); }
      body.append(grid,node('p','Our contribution: make the boundary between a measured result, an extrapolation and a missing answer visible.'),action('Explore the evidence','evidence'),action('Try the digital robotics lab','robotics'));
    } else if(tab==='method') {
      body.append(renderMethod({action,onTopic(id){show(id);tabs.get(id)?.focus();}}));
    } else if(tab==='agents') {
      body.append(node('p','Software roles with inspectable work. Extraction is prepared in the dataset; checks, ranking and drill rules run locally. These are not live conversations with separate language models.','mission-lead'));
      const pipeline=node('div',null,'mission-pipeline');
      for(const [role,work,station,task] of [
        ['Extractor','Organizes the NASA investigations and recorded conditions.','evidence','compare'],
        ['Verifier','Checks the source trail and exposes the evidence checks.','trust','checks'],
        ['Ranker','Compares findings with your selected cabin and shows coverage gaps.','evidence','overview'],
        ['Officer','Connects a scripted incident to source-linked decisions and missing evidence.','drill',null],
        ['Robotics coordinator','Demonstrates observation, evidence review and a human-approved inspection.','robotics',null]
      ]) {const card=node('article');card.append(node('h3',role),node('p',work),action(`Open ${role.toLowerCase()}`,station,task));pipeline.append(card);}
      body.append(pipeline);
    } else {
      body.append(node('p','Our vision is to give robotic assistants an evidence trail people can inspect. Explore that idea as an interactive software experience.','mission-lead'));
      const grid=node('div',null,'mission-facts');
      const existing=node('article'); existing.append(node('span','NASA REFERENCE','mission-number'),node('h3','Robots already work in orbit'),node('p','NASA’s Astrobee platform supports free-flying robotics research aboard the ISS. Its cameras, autonomy and research payloads provide a real context for this direction.'),link('astrobee'),link('operations'));
      const ours=node('article'); ours.append(node('span','VESTA DIGITAL CONCEPT','mission-number'),node('h3','Make the decision visible'),node('p','A scripted observation enters the workflow. The evidence agent checks your cabin, the coordinator proposes a visual inspection, and a person approves the next step.'));
      const next=node('article'); next.append(node('span','POSSIBLE APPLICATIONS','mission-number'),node('h3','Inspect, document, explain'),node('p','Explore equipment inspection, source-linked mission records and crew training. The animated robot illustrates the workflow; it is not a connected flight system.'));
      grid.append(existing,ours,next);body.append(grid,action('Enter the robotics lab','robotics'));
    }
  }
  close.onclick=()=>dialog.close(); dialog.addEventListener('close',()=>trigger?.isConnected&&trigger.focus());
  return { open(tab='problem',from){trigger=from;show(tab);if(!dialog.open)dialog.showModal();close.focus();},close(){if(dialog.open)dialog.close();},dispose(){dialog.remove();} };
}
