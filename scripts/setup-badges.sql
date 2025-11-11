-- ============================================
-- SETUP COMPLETO DE BADGES - NextLevel
-- ============================================
-- Este script:
-- 1. Cria badges automáticos
-- 2. Reavaliar badges pode ser feito via API
-- ============================================

-- Limpar badges existentes (se necessário - CUIDADO EM PRODUÇÃO!)
-- DELETE FROM gamification_service.funcionario_badges;
-- DELETE FROM gamification_service.badges;

-- ============================================
-- BADGES AUTOMÁTICOS
-- ============================================

-- 🎓 BADGES POR CONCLUSÃO DE CURSOS
INSERT INTO gamification_service.badges (codigo, nome, descricao, criterio, icone_url, pontos_necessarios) VALUES
('PRIMEIRO_CURSO', 'Primeiro Passo', 'Concluiu seu primeiro curso na plataforma', 'concluiu_n_cursos:1', NULL, NULL),
('INICIANTE', 'Iniciante', 'Concluiu 3 cursos', 'concluiu_n_cursos:3', NULL, NULL),
('INTERMEDIARIO', 'Intermediário', 'Concluiu 5 cursos', 'concluiu_n_cursos:5', NULL, NULL),
('AVANCADO', 'Avançado', 'Concluiu 10 cursos', 'concluiu_n_cursos:10', NULL, NULL),
('MESTRE', 'Mestre', 'Concluiu 20 cursos', 'concluiu_n_cursos:20', NULL, NULL),
('GURU', 'Guru', 'Concluiu 50 cursos', 'concluiu_n_cursos:50', NULL, NULL)
ON CONFLICT (codigo) DO NOTHING;

-- 💪 BADGES POR XP
INSERT INTO gamification_service.badges (codigo, nome, descricao, criterio, icone_url, pontos_necessarios) VALUES
('BRONZE', 'Bronze', 'Alcançou 500 pontos de experiência', 'xp_total:500', NULL, 500),
('PRATA', 'Prata', 'Alcançou 1500 pontos de experiência', 'xp_total:1500', NULL, 1500),
('OURO', 'Ouro', 'Alcançou 3000 pontos de experiência', 'xp_total:3000', NULL, 3000),
('PLATINA', 'Platina', 'Alcançou 5000 pontos de experiência', 'xp_total:5000', NULL, 5000),
('DIAMANTE', 'Diamante', 'Alcançou 10000 pontos de experiência', 'xp_total:10000', NULL, 10000),
('LENDARIO', 'Lendário', 'Alcançou 20000 pontos de experiência', 'xp_total:20000', NULL, 20000)
ON CONFLICT (codigo) DO NOTHING;

-- 🎯 BADGES POR ESPECIALIZAÇÃO
INSERT INTO gamification_service.badges (codigo, nome, descricao, criterio, icone_url, pontos_necessarios) VALUES
('ESPECIALISTA', 'Especialista', 'Concluiu 3 cursos da mesma categoria', 'cursos_mesma_categoria:3', NULL, NULL),
('MESTRE_CATEGORIA', 'Mestre da Categoria', 'Concluiu 5 cursos da mesma categoria', 'cursos_mesma_categoria:5', NULL, NULL),
('GURU_CATEGORIA', 'Guru da Categoria', 'Concluiu 10 cursos da mesma categoria', 'cursos_mesma_categoria:10', NULL, NULL)
ON CONFLICT (codigo) DO NOTHING;

-- 🌎 BADGES POR DIVERSIDADE
INSERT INTO gamification_service.badges (codigo, nome, descricao, criterio, icone_url, pontos_necessarios) VALUES
('EXPLORADOR', 'Explorador', 'Completou cursos de 3 departamentos diferentes', 'concluiu_n_areas_diferentes:3', NULL, NULL),
('EXPLORADOR_DE_AREAS', 'Explorador de Áreas', 'Completou cursos de 5 departamentos diferentes', 'concluiu_n_areas_diferentes:5', NULL, NULL),
('MULTIDISCIPLINAR', 'Multidisciplinar', 'Completou cursos de 10 departamentos diferentes', 'concluiu_n_areas_diferentes:10', NULL, NULL)
ON CONFLICT (codigo) DO NOTHING;

-- 🔥 BADGES POR CONSISTÊNCIA (STREAK)
INSERT INTO gamification_service.badges (codigo, nome, descricao, criterio, icone_url, pontos_necessarios) VALUES
('CONSISTENTE', 'Consistente', 'Estudou por 7 dias consecutivos', 'streak_dias:7', NULL, NULL),
('DEDICADO', 'Dedicado', 'Estudou por 30 dias consecutivos', 'streak_dias:30', NULL, NULL),
('INABALAVEL', 'Inabalável', 'Estudou por 60 dias consecutivos', 'streak_dias:60', NULL, NULL)
ON CONFLICT (codigo) DO NOTHING;


-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar badges criados
SELECT 
  codigo,
  nome,
  criterio,
  pontos_necessarios,
  criado_em
FROM gamification_service.badges
ORDER BY codigo;

-- Resultado esperado: 23 badges

-- ============================================
-- ESTATÍSTICAS
-- ============================================

-- Total de badges
SELECT COUNT(*) as total_badges FROM gamification_service.badges;

-- Badges por tipo de critério
SELECT 
  CASE 
    WHEN criterio LIKE 'concluiu_n_cursos%' THEN 'Conclusão de Cursos'
    WHEN criterio LIKE 'xp_total%' THEN 'XP Total'
    WHEN criterio LIKE 'cursos_mesma_categoria%' THEN 'Especialização'
    WHEN criterio LIKE 'concluiu_n_areas_diferentes%' THEN 'Diversidade'
    WHEN criterio LIKE 'streak_dias%' THEN 'Consistência'
    WHEN criterio LIKE 'prazo_conclusao_curso%' THEN 'Performance'
    ELSE 'Outros'
  END as tipo_criterio,
  COUNT(*) as quantidade
FROM gamification_service.badges
WHERE criterio IS NOT NULL
GROUP BY tipo_criterio
ORDER BY quantidade DESC;


