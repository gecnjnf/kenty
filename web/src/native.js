const isNative=()=>Boolean(window.Capacitor?.isNativePlatform?.());const isElectron=()=>Boolean(window.kentyDesktop?.isDesktop);
export async function initializeNativeShell(){
 if(isElectron()){document.documentElement.dataset.platform='desktop';return;}
 if(!isNative())return;
 document.documentElement.dataset.platform=window.Capacitor.getPlatform();
 window.kentyEnablePushNotifications=async()=>{
  try{const{PushNotifications}=await import('@capacitor/push-notifications');let p=await PushNotifications.checkPermissions();if(p.receive==='prompt')p=await PushNotifications.requestPermissions();if(p.receive!=='granted')return{ok:false,message:'Разрешение на уведомления не выдано.'};
   await PushNotifications.addListener('registration',t=>window.dispatchEvent(new CustomEvent('kenty:push-token',{detail:t.value})));
   await PushNotifications.addListener('registrationError',e=>console.error('KENTY push registration failed:',e));
   await PushNotifications.addListener('pushNotificationReceived',n=>window.dispatchEvent(new CustomEvent('kenty:push-received',{detail:n})));
   await PushNotifications.addListener('pushNotificationActionPerformed',a=>window.dispatchEvent(new CustomEvent('kenty:push-action',{detail:a})));
   await PushNotifications.register();return{ok:true,message:'Разрешение получено. Для доставки уведомлений серверу нужны FCM/APNs настройки.'};
  }catch(e){return{ok:false,message:e?.message||'Не удалось включить уведомления.'};}
 };
}
export const nativeEnvironment={isNative,isElectron};
