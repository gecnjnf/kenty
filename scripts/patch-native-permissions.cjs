const fs=require('node:fs');\nconst path=require('node:path');\nconst root=path.resolve(__dirname,'..');
const platform=process.argv[2];
function insertPlist(key,value){
 const file=path.join(root,'web/ios/App/App/Info.plist');let xml=fs.readFileSync(file,'utf8');
 if(!xml.includes('<key>'+key+'</key>'))xml=xml.replace('</dict>','  <key>'+key+'</key>\n  <string>'+value+'</string>\n</dict>');
 fs.writeFileSync(file,xml);
}
if(platform==='ios'){
 insertPlist('NSCameraUsageDescription','KENTY использует камеру, чтобы делать и отправлять фотографии в личных чатах.');
 insertPlist('NSMicrophoneUsageDescription','KENTY использует микрофон для голосовых комнат и звонков.');
 insertPlist('NSPhotoLibraryUsageDescription','KENTY использует выбранные фотографии для отправки друзьям.');
 insertPlist('NSPhotoLibraryAddUsageDescription','KENTY может сохранять фотографии на ваше устройство по вашему запросу.');
}else if(platform==='android'){
 const file=path.join(root,'web/android/app/src/main/AndroidManifest.xml');let xml=fs.readFileSync(file,'utf8');
 const permissions=['android.permission.CAMERA','android.permission.RECORD_AUDIO','android.permission.POST_NOTIFICATIONS'];
 for(const permission of permissions){const tag='<uses-permission android:name="'+permission+'"/>';if(!xml.includes(permission))xml=xml.replace('<application',tag+'\n    <application');}
 if(!xml.includes('android.hardware.camera'))xml=xml.replace('<application','<uses-feature android:name="android.hardware.camera.any" android:required="false"/>\n    <application');
 fs.writeFileSync(file,xml);
}else{throw new Error('Pass ios or android');}
console.log('Patched '+platform+' camera, microphone and notification permissions');
