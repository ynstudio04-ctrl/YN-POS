import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);

window.requestAnimationFrame(()=>{
  const boot=document.getElementById('boot-screen');
  if(boot){
    boot.style.opacity='0';
    boot.style.transition='opacity .18s ease';
    window.setTimeout(()=>boot.remove(),180);
  }
});
