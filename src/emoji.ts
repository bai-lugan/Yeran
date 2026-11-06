import {computed,ref,shallowRef} from 'vue'
import type {Editor} from '@tiptap/core'
import type {EditorView} from '@tiptap/pm/view'
import type {Node as PMNode} from '@tiptap/pm/model'
import {closeHistory} from '@tiptap/pm/history'

type Emoji={emoji:string;aliases:string[];description:string;search:string}
type Query={from:number;to:number;query:string;token:string;complete:boolean;left:number;top:number;height:number}
const chinese:Record<string,string>={smile:'微笑 开心 開心 笑脸 笑臉',smiley:'笑脸 笑臉 开心 開心',joy:'笑哭 眼泪 眼淚',laughing:'大笑 开心 開心',blush:'害羞 脸红 臉紅',wink:'眨眼',heart:'红心 紅心 爱心 愛心 喜欢 喜歡',heart_eyes:'喜欢 喜歡 爱 愛',cry:'哭 难过 難過',sob:'大哭',thinking:'思考 想',angry:'生气 生氣 愤怒 憤怒',sunglasses:'墨镜 墨鏡 酷',tada:'庆祝 慶祝 礼花 禮花',rocket:'火箭 发射 發射',fire:'火 热 火熱',star:'星星',sparkles:'闪亮 閃亮',thumbsup:'赞 讚 点赞 點讚 好',thumbsdown:'不赞 不讚 差',clap:'鼓掌',pray:'祈祷 祈禱 感谢 感謝',ok_hand:'好的 没问题 沒問題',wave:'挥手 揮手 你好 再见 再見',white_check_mark:'完成 对勾 對勾 通过 通過',x:'叉 错误 錯誤',warning:'警告 注意',bulb:'灯泡 燈泡 灵感 靈感',memo:'笔记 筆記 记录 記錄',book:'书 書',computer:'电脑 電腦',coffee:'咖啡',tea:'茶',cake:'蛋糕 生日',dog:'狗',cat:'猫 貓',sunny:'太阳 太陽 晴天',moon:'月亮',rainbow:'彩虹',gift:'礼物 禮物',muscle:'加油 肌肉',handshake:'握手 合作',eyes:'眼睛 看',100:'满分 滿分 一百分',cn:'中国 中國',us:'美国 美國',gb:'英国 英國',jp:'日本',tw:'台湾 台灣'}
let dataset:Promise<Emoji[]>|undefined
function loadEmoji(){return dataset ||= import('./emoji-data.json').then(({default:rows})=>(rows as [string,string[],string,string[]][]).map(([emoji,aliases,description,tags])=>({emoji,aliases,description,search:[...aliases,description,...tags,...aliases.map(alias=>chinese[alias]||'')].join(' ').toLowerCase()}))).catch(error=>{dataset=undefined;throw error})}

export function useEmojiMenu(getEditor:()=>Editor|undefined){
  const state=ref<Query|null>(null),selected=ref(0),entries=shallowRef<Emoji[]>([]),loading=ref(false),failed=ref(false)
  let dismissed='',disposed=false,pending:{from:number;token:string;doc?:PMNode}|undefined
  const signature=(range:Query)=>`${range.from}/${range.to}/${range.token}`
  const items=computed(()=>{
    const query=state.value?.query.toLowerCase();if(!query)return[]
    return entries.value.map((entry,index)=>({entry,index,rank:entry.aliases.includes(query)?0:entry.aliases.some(alias=>alias.startsWith(query))?1:entry.search.includes(query)?2:3})).filter(row=>row.rank<3).sort((a,b)=>a.rank-b.rank||(a.rank===1?a.entry.aliases.find(alias=>alias.startsWith(query))!.length-b.entry.aliases.find(alias=>alias.startsWith(query))!.length:0)||a.index-b.index).slice(0,8).map(row=>row.entry)
  })
  function close(){if(state.value)dismissed=signature(state.value);state.value=null;pending=undefined}
  function reset(){state.value=null;pending=undefined;dismissed=''}
  function detect():Query|null{
    const editor=getEditor();if(!editor||editor.isDestroyed||!editor.isFocused||editor.view.composing||editor.storage.plainTextMode.enabled)return null
    const {selection,storedMarks}=editor.state,{$from,empty}=selection
    if(!empty||!$from.parent.isTextblock||$from.parent.type.spec.code||(storedMarks??$from.marks()).some(mark=>['code','link'].includes(mark.type.name)))return null
    if(/[\p{L}\p{N}_+\-:]/u.test($from.parent.textBetween($from.parentOffset,$from.parentOffset+Math.min(1,$from.parent.content.size-$from.parentOffset))))return null
    const before=$from.parent.textBetween(0,$from.parentOffset,'\n','\ufffc'),match=/(?:^|[\s([{])(:([\p{L}\p{N}_+\-]{1,40})(:)?)(?![\s\S])/u.exec(before)
    if(!match)return null
    const rect=editor.view.coordsAtPos(selection.from),height=Math.min(365,Math.max(160,innerHeight-110)),below=innerHeight-rect.bottom-12
    if(rect.bottom<85||rect.top>innerHeight)return null
    return{from:selection.from-match[1]!.length,to:selection.from,query:match[2]!,token:match[1]!,complete:!!match[3],left:Math.max(12,Math.min(rect.left,innerWidth-342)),top:Math.max(90,below>=height?rect.bottom+7:rect.top-height-7),height}
  }
  function execute(index=selected.value,entry=items.value[index]){
    const editor=getEditor(),range=state.value;if(!editor||!range||!entry||editor.view.composing)return false
    const {selection,doc}=editor.state
    if(!selection.empty||selection.from!==range.to||doc.textBetween(range.from,range.to,'\n','\ufffc')!==range.token){reset();return false}
    dismissed=signature(range);pending=undefined;state.value=null
    editor.view.dispatch(closeHistory(editor.state.tr).insertText(entry.emoji,range.from,range.to).scrollIntoView())
    editor.view.dispatch(closeHistory(editor.state.tr));editor.view.focus();return true
  }
  function refresh(){
    if(disposed)return
    const next=detect();if(!next){reset();return}
    if(signature(next)===dismissed){state.value=null;return}
    const previous=state.value;state.value=next
    if(!previous||previous.query!==next.query||previous.from!==next.from)selected.value=0
    if(!entries.value.length&&!loading.value){loading.value=true;failed.value=false;void loadEmoji().then(data=>{if(disposed)return;entries.value=data;loading.value=false;refresh()}).catch(()=>{if(disposed)return;loading.value=false;failed.value=true})}
    const editor=getEditor()!
    if(pending&&next.complete&&next.from===pending.from&&next.token===pending.token){
      if(pending.doc&&pending.doc!==editor.state.doc){pending=undefined;return}
      pending.doc=editor.state.doc
      const exact=entries.value.find(entry=>entry.aliases.includes(next.query.toLowerCase()))
      if(exact)execute(0,exact)
    }
  }
  function keyDown(view:EditorView,event:KeyboardEvent){
    if(event.isComposing||view.composing){state.value=null;pending=undefined;return false}
    refresh()
    if(event.key===':'&&state.value&&!state.value.complete){pending={from:state.value.from,token:state.value.token+':'};return false}
    pending=undefined
    if(!state.value||event.ctrlKey||event.metaKey||event.altKey)return false
    if(event.shiftKey&&['ArrowUp','ArrowDown','Enter','Tab'].includes(event.key)){close();return false}
    if(event.key==='Escape'){close();return true}
    if(items.value.length&&(event.key==='ArrowDown'||event.key==='ArrowUp')){selected.value=(selected.value+(event.key==='ArrowUp'?-1:1)+items.value.length)%items.value.length;return true}
    if(items.value.length&&(event.key==='Enter'||event.key==='Tab')&&!event.shiftKey)return execute()
    return false
  }
  function dispose(){disposed=true;reset()}
  return{state,selected,items,loading,failed,refresh,keyDown,execute,close,reset,dispose}
}
