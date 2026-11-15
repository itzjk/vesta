import { CONCERNS } from '../core/index.js';

// Selection is presentation state. It never changes the evidence review queue,
// matching method, task approval or a completed report.
export function requestedReviewSelection(request, materials, selected=[]){
  if(!request||!Object.hasOwn(materials,request.material)||!CONCERNS.includes(request.concern))return null;
  const next=[...new Set(selected)];if(!next.includes(request.material))next.push(request.material);
  return {focus:{material:request.material,concern:request.concern},materials:next,inventoryChanged:!selected.includes(request.material)};
}

export function chooseReviewFocus(report,focus,explicit=false){
  const requested=explicit&&report?.questions.find(question=>question.material_id===focus?.material&&question.concern===focus?.concern);
  const question=requested||report?.questions.find(question=>question.id===report.priority?.[0]?.question_id);
  return question?{material:question.material_id,concern:question.concern,explicit:Boolean(requested)}:null;
}
