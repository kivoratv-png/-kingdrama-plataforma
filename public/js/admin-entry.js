import { dashboard } from './admin.js?v=2b974c99d6e0';
const root=document.getElementById('admin-root');
root.innerHTML=await dashboard();
dashboard.mount(root);
