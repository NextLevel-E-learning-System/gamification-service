export const openapiSpec = {
  "openapi": "3.0.3",
  "info": { "title": "Gamification Service API", "version": "1.0.0" },
  "paths": {
    "/gamification/v1/badges": {
      "get": {
        "summary": "Listar badges",
        "tags": ["badges"],
        "responses": { "200": { "description": "OK", "content": { "application/json": { "schema": { "type": "array", "items": { "$ref": "#/components/schemas/Badge" } } } } } }
      },
      "post": {
        "summary": "Criar badge",
        "tags": ["badges"],
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/NewBadge" } } } },
        "responses": { "201": { "description": "Criado" }, "409": { "description": "Duplicado" } }
      }
    },
    "/gamification/v1/badges/{codigo}": {
      "get": {
        "summary": "Obter badge",
        "tags": ["badges"],
        "parameters": [{ "name": "codigo", "in": "path", "required": true, "schema": { "type": "string" } }],
        "responses": { "200": { "description": "OK" }, "404": { "description": "Não encontrado" } }
      }
    },
    "/gamification/v1/me": {
      "get": {
        "summary": "Perfil gamification do usuário autenticado (mock userId via header X-User-Id)",
        "tags": ["perfil"],
        "parameters": [{ "name": "X-User-Id", "in": "header", "required": true, "schema": { "type": "string", "format": "uuid" } }],
        "responses": { "200": { "description": "OK", "content": { "application/json": { "schema": { "type": "object", "properties": { "userId": { "type": "string" }, "xp": { "type": "integer" }, "nivel": { "type": "string", "description": "Iniciante | Intermediário | Avançado" }, "proximoNivelXp": { "type": "integer" }, "badges": { "type": "array", "items": { "type": "object", "properties": { "codigo": { "type": "string" }, "nome": { "type": "string" } } } } } } } } } }
      }
    },
    "/gamification/v1/conquistas": {
      "get": {
        "summary": "Listar conquistas do usuário (perfil + badges + histórico XP)",
        "tags": ["conquistas"],
        "parameters": [{ "name": "X-User-Id", "in": "header", "required": true, "schema": { "type": "string", "format": "uuid" } }],
        "responses": { "200": { "description": "OK", "content": { "application/json": { "schema": { "type": "object", "properties": { "userId": { "type": "string" }, "xp": { "type": "integer" }, "nivel": { "type": "string", "description": "Iniciante | Intermediário | Avançado" }, "proximoNivelXp": { "type": "integer" }, "badges": { "type": "array", "items": { "type": "object", "properties": { "codigo": { "type": "string" }, "nome": { "type": "string" } } } }, "historicoXp": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "xp_ganho": { "type": "integer" }, "motivo": { "type": "string" }, "referencia_id": { "type": ["string", "null"] } } } } } } } } } }
      }
    },
    "/gamification/v1/badges/auto/process": {
      "post": {
        "summary": "Forçar reprocessamento de badges automáticos (PRIMEIRO_CURSO, MARATONISTA, EXPERT)",
        "tags": ["badges"],
        "parameters": [{ "name": "X-User-Id", "in": "header", "required": false, "schema": { "type": "string", "format": "uuid" } }],
        "responses": { "202": { "description": "Processamento agendado", "content": { "application/json": { "schema": { "type": "object", "properties": { "status": { "type": "string" }, "processed": { "type": "integer" } } } } } } }
      }
    },
    "/gamification/v1/ranking/global": {
      "get": { "summary": "Ranking global por XP", "tags": ["ranking"], "responses": { "200": { "description": "OK" } } }
    },
    "/gamification/v1/ranking/departamento": {
      "get": { "summary": "Ranking por departamento (mock header X-Departamento-Id)", "tags": ["ranking"], "parameters": [{ "name": "X-Departamento-Id", "in": "header", "required": true, "schema": { "type": "string" } }], "responses": { "200": { "description": "OK" } } }
    },
    "/gamification/v1/ranking/monthly": {
      "get": {
        "summary": "Ranking mensal (global ou departamento)",
        "tags": ["ranking"],
        "parameters": [
          { "name": "mes", "in": "query", "required": false, "schema": { "type": "string", "pattern": "^\\d{4}-\\d{2}$" }, "description": "Filtro mês (YYYY-MM). Default mês atual" },
          { "name": "departamento", "in": "query", "required": false, "schema": { "type": "string" }, "description": "Filtra por departamento" }
        ],
        "responses": { "200": { "description": "OK", "content": { "application/json": { "schema": { "type": "array", "items": { "$ref": "#/components/schemas/RankingEntry" } } } } } }
      }
    },
    "/gamification/v1/users/{id}/badges": {
      "get": {
        "summary": "Badges de um usuário",
        "tags": ["badges"],
        "parameters": [ { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } } ],
        "responses": { "200": { "description": "OK", "content": { "application/json": { "schema": { "type": "array", "items": { "$ref": "#/components/schemas/Badge" } } } } } }
      }
    },
    "/gamification/v1/users/{id}/xp-history": {
      "get": {
        "summary": "Histórico de XP (recente)",
        "tags": ["xp"],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } },
          { "name": "limit", "in": "query", "schema": { "type": "integer", "minimum": 1, "maximum": 100 }, "required": false },
          { "name": "cursor", "in": "query", "schema": { "type": "string" }, "required": false }
        ],
        "responses": { "200": { "description": "OK", "content": { "application/json": { "schema": { "type": "object", "properties": { "items": { "type": "array", "items": { "$ref": "#/components/schemas/XpHistoryItem" } }, "nextCursor": { "type": ["string", "null"] } } } } } } }
      }
    }
  },
  "components": {
    "schemas": {
      "Badge": { "type": "object", "properties": { "codigo": { "type": "string" }, "nome": { "type": "string" }, "descricao": { "type": "string" }, "criterio": { "type": "string" }, "icone_url": { "type": "string" }, "pontos_necessarios": { "type": "integer" } }, "required": ["codigo", "nome"] },
      "NewBadge": { "allOf": [ { "$ref": "#/components/schemas/Badge" } ] },
      "RankingEntry": { "type": "object", "properties": { "posicao": { "type": "integer" }, "userId": { "type": "string" }, "xpMes": { "type": "integer" } }, "required": ["posicao", "userId", "xpMes"] },
      "XpHistoryItem": { "type": "object", "properties": { "id": { "type": "string" }, "xp_ganho": { "type": "integer" }, "motivo": { "type": "string" }, "referencia_id": { "type": ["string", "null"] } }, "required": ["id", "xp_ganho", "motivo"] }
    }
  }
} as const;