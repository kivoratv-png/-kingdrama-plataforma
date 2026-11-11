import { dashboard } from './admin.js?v=48397e6a9d1c';
const root=document.getElementById('admin-root');
root.innerHTML=await dashboard();
dashboard.mount(root);
