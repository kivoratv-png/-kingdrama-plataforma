# Painel independente

`/admin` serve `public/admin/index.html`, sem SDK Supabase, sessão dos clientes ou aplicativo principal. Nenhuma conta em `auth.users` autoriza o painel. `admin_accounts` está vazio e as antigas RPCs administrativas não podem mais ser chamadas por clientes.

O acesso exige usuário, senha exclusiva e TOTP em cada entrada. A configuração inicial usa um link aleatório de 256 bits no fragmento, removido da barra ao abrir a página. O banco guarda apenas o hash e a validade de 24 horas. Não publique esses links.

O QR code é gerado localmente. A senha usa scrypt com salt individual; o segredo TOTP usa AES-256-GCM. A chave é derivada por HKDF-SHA256 da chave do servidor com contexto exclusivo. Antes de rotacionar `SUPABASE_SERVICE_ROLE_KEY`, recriptografe os segredos ou providencie nova configuração. Não imprima credenciais em logs.

O login consome atomicamente o intervalo TOTP, impedindo repetição de código. Dez tentativas acumuladas bloqueiam por cinco minutos. O acesso combina cookie Secure/HttpOnly/SameSite=Strict e token de página somente em memória. Cookie sozinho e JWT da plataforma não dão acesso. Nova abertura ou recarregamento exige novo login. A sessão tem saída explícita, revogação ao deixar a página, limite de quatro horas e inatividade máxima de vinte minutos. Novo login substitui a sessão anterior.

As tabelas `admin_console_credentials` e `admin_console_sessions` e RPCs `admin_console_*` são exclusivas de `service_role`. A função Netlify valida a autenticação independente antes de consultar ou alterar dados. Assinaturas e vídeos dos clientes continuam no fluxo existente.

Migração: `node scripts/profile-db.js --independent-admin`. Para testes transacionais com rollback, adicionar `--test`. Testes HTTP e TOTP: `node --test scripts/admin-security.test.mjs`.

QR local: qrcodejs (MIT), commit `04f46c6a0708418cb7b96fc563eacae0fbf77674`, https://github.com/davidshimjs/qrcodejs. Player externo: API oficial Bunny Player.js 0.1.0, servida localmente.
