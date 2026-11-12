# Hospedagem permanente no Render

O arquivo `render.yaml` prepara um serviço web com frontend e API no mesmo endereço HTTPS e um disco persistente para a sessão. A configuração usa uma instância paga e 1 GB de disco. Confira o custo no Render antes de criar o serviço.

## Publicar

1. Envie os commits da `main` para o GitHub.
2. No Render, crie um Blueprint a partir de `https://github.com/perepepeu/PrevLoss`, branch `main`, arquivo `render.yaml`.
3. Defina `PREVLOSS_ACCESS_PASSWORD` no campo secreto solicitado pelo Render. Use uma senha forte e compartilhe-a separadamente do link. O nome de usuário é `prevloss`.
4. Revise o plano e o disco antes de aprovar a criação. Aguarde o deploy e abra a URL `https://...onrender.com` exibida pelo serviço.

O Render fornece HTTPS. Ao abrir a página, o navegador pede usuário e senha. O endpoint `/api/saude` permanece sem autenticação para a verificação de saúde; a interface e os comandos da simulação exigem senha. O backend usa um único worker e guarda o histórico em `/var/data/session.json` no disco persistente.

O histórico do computador local não é enviado automaticamente para a hospedagem: o serviço começa uma sessão nova. Reiniciar ou atualizar o serviço restaura a sessão hospedada pausada. O arquivo cresce com as leituras; acompanhe o uso do disco no Render.

Para validar o deploy, abra a página em outro dispositivo, autentique-se e confira **Sistema online**. Inicie a linha de base, confirme as leituras e reinicie o serviço pelo painel do Render; a sessão deve reaparecer pausada com o mesmo histórico.
