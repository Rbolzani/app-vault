# DocVault — Como Usar

## Iniciar o aplicativo

Abra um terminal na pasta raiz do projeto e execute:

```
npm start
```

Isso inicia os dois servidores automaticamente:
- **Backend** (API + banco de dados): http://localhost:3001
- **Frontend** (interface): http://localhost:5173

Acesse **http://localhost:5173** no navegador.

---

## Estrutura do projeto

```
App Controle de Documentos/
├── backend/         → Servidor Node.js (API REST)
│   ├── server.js    → Rotas da API
│   ├── db.js        → Banco de dados SQLite (node:sqlite embutido)
│   ├── data/        → Arquivo docvault.db (criado automaticamente)
│   └── uploads/     → Arquivos enviados (criado automaticamente)
├── frontend/        → Interface React + Vite
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       └── components/
└── package.json     → Script "npm start" que roda os dois juntos
```

## Tipos de documento padrão

| Tipo        | Cor     | Exemplos                              |
|-------------|---------|---------------------------------------|
| Identidade  | Índigo  | RG, CPF, CNH, Passaporte              |
| Contratos   | Âmbar   | Aluguel, Trabalho, Prestação          |
| Apólices    | Verde   | Seguro de vida, Auto, Residencial     |
| Financeiro  | Azul    | IRPF, Extratos, Comprovantes          |
| Saúde       | Vermelho| Plano de saúde, Vacinas, Exames       |
| Outros      | Violeta | Diplomas, Certidões, Demais docs      |

## Funcionalidades

- **Cadastro** de documentos com título, tipo, número, emissor, datas e arquivo (PDF/imagem)
- **Upload de arquivo** por clique ou drag-and-drop (PDF, JPG, PNG — máx. 20 MB)
- **Visualização** de arquivo em nova aba do navegador
- **Edição** de qualquer campo ou troca do arquivo
- **Exclusão** de documento (remove também o arquivo do disco)
- **Busca** por título, emissor, número ou descrição
- **Filtros** por tipo (sidebar) e por status de validade (Válido / A vencer / Vencido)
- **Dashboard** com estatísticas, documentos próximos ao vencimento e cadastros recentes
