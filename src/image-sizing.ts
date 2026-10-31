import {ref,watch} from 'vue'
let locked=true
try{locked=localStorage.getItem('yeran.image-ratio.v1')!=='false'}catch{}
export const imageRatioLocked=ref(locked)
watch(imageRatioLocked,value=>{try{localStorage.setItem('yeran.image-ratio.v1',JSON.stringify(value))}catch{}})
