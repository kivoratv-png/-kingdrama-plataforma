import { dashboard } from './admin.js?v=b202261b30d2';
const root=document.getElementById('admin-root');
root.innerHTML=await dashboard();
dashboard.mount(root);
