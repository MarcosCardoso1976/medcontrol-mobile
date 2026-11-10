# MedControl Mobile — Como instalar e publicar o app

O app é nativo (Android/iOS), não um site, então a **Vercel não consegue hospedá-lo**. Cada peça fica num lugar:

| Peça | Onde fica |
|---|---|
| Código do app (`medcontrol-mobile`) | **GitHub** |
| API + banco (o Next.js que você já tem) | **Vercel + Neon**, como hoje |
| O aplicativo instalado | **o celular**, gerado pelo **EAS Build** (da Expo) |

O app só chama a URL da sua API da Vercel (`EXPO_PUBLIC_API_URL`).

---

## 1. Colocar o código no GitHub

```bash
cd medcontrol-mobile
git init
git add .
git commit -m "MedControl mobile"
git branch -M main
git remote add origin https://github.com/MarcosCardoso1976/medcontrol-mobile.git
git push -u origin main
```

- O `.gitignore` já deixa de fora `node_modules` e o `.env`.
- Use um repositório **privado**.
- **Nunca** suba senhas ou a connection string do Neon.

---

## 2. Instalar no seu celular (Android)

1. Troque `https://SEU-APP.vercel.app` pela URL real da API, nos três perfis do `eas.json`.
2. Rode:

   ```bash
   npx eas-cli login
   npx eas-cli build --platform android --profile preview
   ```

3. No fim do build você recebe um **link e um QR code** de um `.apk`. Abra no celular, baixe e instale.
   - O Android vai pedir para permitir "instalar apps de fontes desconhecidas".
   - É um app normal: funciona sem o computador.
   - Dá para mandar o link para família e amigos testarem.

### Qual perfil usar

| Perfil | Quando usar |
|---|---|
| `preview` | Instalar e usar o app no dia a dia / testar com outras pessoas |
| `development` | Só quando for mexer no código e testar em tempo real com `npx expo start --dev-client` |
| `production` | Gerar o pacote para a loja (`.aab`) |

> O plano gratuito da Expo tem limite de builds por mês e fila de espera. Confira os limites atuais no site da Expo.

---

## 3. Publicar nas lojas (quando estiver pronto)

### Google Play (Android)

- Conta de desenvolvedor com taxa única de cerca de **US$ 25**.
- Gere o pacote com `--profile production` (cria um `.aab`) e envie pelo **Play Console**.
- Contas pessoais novas costumam precisar de um período de **teste fechado** antes de publicar. Confira a regra atual na Play Console.

### iPhone (iOS)

- Exige **Apple Developer**, cerca de **US$ 99 por ano**.
- Distribuição pela **TestFlight** ou pela **App Store**.
- Só vale a pena se você tiver usuários de iPhone.

### Itens obrigatórios para publicar

- **Política de privacidade**: são dados de saúde, então a **LGPD** se aplica.
- **Justificativa do alarme exato** na Play Console (permissão `SCHEDULE_EXACT_ALARM`).
- Aviso de uso: o app é um lembrete e **não substitui orientação médica**.

---

## 4. Antes de ir para o banco de dados

Faça os testes num **APK real** (passo 2), e não só no Expo Go. É lá que você confirma o alarme tocando com o app **fechado** e a **tela bloqueada**.

### Roteiro rápido de teste

1. Abra o app → **Configurações → Alarmes** e conclua o passo a passo (notificações, "Alarmes e lembretes", bateria).
2. Toque em **"Testar em 10 s"**, feche o app (arraste dos recentes) e bloqueie a tela.
3. O alarme deve tocar em ~10 segundos.
4. Cadastre um remédio para daqui a 2 minutos, feche o app e confirme que o aviso chega.
5. Teste todas as funções: cadastro, edição, duplicar, marcar/desmarcar dose, estoque (unidades, volume, dosagem), listas, histórico, tema claro/escuro.

---

## 5. Próxima etapa: banco de dados

Depois dos testes, seguimos com:

1. Aplicar o **patch de segurança do backend** (`backend-patch/APLICAR.md`).
2. Conferir a **sincronização com o Neon**.
3. Trazer os dados do PWA pelo **código de vínculo** (página `/vinculo` do PWA).
4. Lembrete: **rotacionar as credenciais** que estavam no `.env` enviado anteriormente (Neon, Asaas, VAPID e `CRON_SECRET`).
