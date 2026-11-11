import { icon } from './lib.js?v=2b974c99d6e0';
let library;
export function loadPlayerControl(){
 if(window.playerjs)return Promise.resolve(window.playerjs.Player);
 library ||= new Promise((resolve,reject)=>{
  const script=Object.assign(document.createElement('script'),{src:'/vendor/playerjs.min.js?v=2b974c99d6e0',async:true});
  script.onload=()=>resolve(window.playerjs.Player);script.onerror=()=>{library=null;reject(Error('Não foi possível carregar o controle do vídeo.'));};document.head.append(script);
 });
 return library;
}
export function mountPlayerButton(root){
 const button=root.querySelector('[data-player-watch]'),frame=root.querySelector('iframe'),video=root.querySelector('video'),feedback=root.querySelector('[data-player-feedback]');
 if(!button)return;
 let alive=true,paused=true,control=null,requested=false;
 const label=playing=>{if(!alive)return;paused=!playing;button.innerHTML=`${playing?icon.pause:icon.play} ${playing?'Pausar':'Assistir'}`;button.setAttribute('aria-label',playing?'Pausar vídeo':'Assistir ao vídeo');};
 const onPlay=()=>label(true),onPause=()=>label(false);
 if(frame&&window.playerjs){
  control=new window.playerjs.Player(frame);
  control.on('ready',()=>{if(!alive)return;button.disabled=false;if(requested)control.play();});
  control.on('play',onPlay);control.on('pause',onPause);control.on('ended',onPause);
 }else if(video){video.addEventListener('play',onPlay);video.addEventListener('pause',onPause);video.addEventListener('ended',onPause);}
 button.addEventListener('click',async()=>{
  if(!alive)return;
  if(control){requested=true;paused?control.play():control.pause();return;}
  if(video){try{if(video.paused)await video.play();else video.pause();}catch{if(feedback)feedback.textContent='Toque no botão de reprodução do vídeo para começar.';}return;}
  if(frame){frame.focus();if(feedback)feedback.textContent='Toque em reproduzir no player para começar.';}
  else if(feedback)feedback.textContent='O vídeo não está disponível para reprodução no momento.';
 });
 return ()=>{alive=false;if(control){control.off('ready');control.off('play');control.off('pause');control.off('ended');}if(video){video.removeEventListener('play',onPlay);video.removeEventListener('pause',onPause);video.removeEventListener('ended',onPause);}};
}
