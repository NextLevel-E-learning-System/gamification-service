-- ============================================
-- SCRIPT DE REAVALIAÇÃO DE BADGES
-- Atualiza badges para TODOS os funcionários existentes
-- ============================================

DO $$
DECLARE
  v_user RECORD;
  v_badge RECORD;
  v_total_users INT := 0;
  v_total_badges_awarded INT := 0;
  v_event_id TEXT;
BEGIN
  RAISE NOTICE '🔄 Iniciando reavaliação de badges...';
  RAISE NOTICE '';

  -- Contar funcionários
  SELECT COUNT(*) INTO v_total_users 
  FROM user_service.funcionarios 
  WHERE ativo = true;
  
  RAISE NOTICE '📊 Total de funcionários ativos: %', v_total_users;
  RAISE NOTICE '';

  -- Para cada funcionário ativo
  FOR v_user IN 
    SELECT id, nome 
    FROM user_service.funcionarios 
    WHERE ativo = true 
    ORDER BY nome
  LOOP
    RAISE NOTICE '⏳ Processando: % (%)', v_user.nome, v_user.id;
    
    v_event_id := 'manual_reeval_' || v_user.id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT;
    
    -- Para cada badge do sistema
    FOR v_badge IN 
      SELECT codigo, nome, criterio 
      FROM gamification_service.badges 
      WHERE criterio IS NOT NULL
    LOOP
      DECLARE
        v_already_has BOOLEAN;
        v_criterio_tipo TEXT;
        v_criterio_valor INT;
        v_atende_criterio BOOLEAN := FALSE;
        v_count INT;
        v_xp INT;
      BEGIN
        -- Verificar se já possui o badge
        SELECT EXISTS(
          SELECT 1 
          FROM gamification_service.funcionario_badges 
          WHERE funcionario_id = v_user.id 
          AND badge_id = v_badge.codigo
        ) INTO v_already_has;
        
        IF v_already_has THEN
          CONTINUE; -- Pula para próximo badge
        END IF;
        
        -- Parse do critério (formato: "tipo:valor")
        v_criterio_tipo := SPLIT_PART(v_badge.criterio, ':', 1);
        v_criterio_valor := SPLIT_PART(v_badge.criterio, ':', 2)::INT;
        
        -- Avaliar critério
        CASE v_criterio_tipo
          
          -- CURSOS CONCLUÍDOS
          WHEN 'concluiu_n_cursos' THEN
            SELECT COUNT(DISTINCT curso_id) INTO v_count
            FROM progress_service.inscricoes
            WHERE funcionario_id = v_user.id
            AND status = 'CONCLUIDO';
            
            v_atende_criterio := v_count >= v_criterio_valor;
          
          -- XP TOTAL
          WHEN 'xp_total', 'pontos_necessarios' THEN
            SELECT COALESCE(xp_total, 0) INTO v_xp
            FROM user_service.funcionarios
            WHERE id = v_user.id;
            
            v_atende_criterio := v_xp >= v_criterio_valor;
          
          -- CURSOS DA MESMA CATEGORIA
          WHEN 'cursos_mesma_categoria' THEN
            SELECT MAX(cnt) INTO v_count
            FROM (
              SELECT COUNT(*) as cnt
              FROM progress_service.inscricoes i
              JOIN course_service.cursos c ON i.curso_id = c.codigo
              WHERE i.funcionario_id = v_user.id
              AND i.status = 'CONCLUIDO'
              GROUP BY c.categoria_id
            ) sub;
            
            v_atende_criterio := COALESCE(v_count, 0) >= v_criterio_valor;
          
          -- ÁREAS/DEPARTAMENTOS DIFERENTES
          WHEN 'concluiu_n_areas_diferentes' THEN
            SELECT COUNT(DISTINCT cat.departamento_codigo) INTO v_count
            FROM progress_service.inscricoes i
            JOIN course_service.cursos c ON i.curso_id = c.codigo
            JOIN course_service.categorias cat ON c.categoria_id = cat.codigo
            WHERE i.funcionario_id = v_user.id
            AND i.status = 'CONCLUIDO'
            AND cat.departamento_codigo IS NOT NULL;
            
            v_atende_criterio := v_count >= v_criterio_valor;
          
          -- STREAK DIAS
          WHEN 'streak_dias' THEN
            -- Streak não está implementado no schema atual
            -- Deixar como 0 por enquanto
            v_count := 0;
            v_atende_criterio := v_count >= v_criterio_valor;
          
          ELSE
            -- Critério desconhecido, pula
            CONTINUE;
        END CASE;
        
        -- Se atende o critério, atribui o badge
        IF v_atende_criterio THEN
          -- Inserir badge
          INSERT INTO gamification_service.funcionario_badges 
            (funcionario_id, badge_id, data_conquista)
          VALUES 
            (v_user.id, v_badge.codigo, NOW())
          ON CONFLICT (funcionario_id, badge_id) DO NOTHING;
          
          -- Registrar XP no histórico (50 XP por badge)
          INSERT INTO gamification_service.historico_xp
            (funcionario_id, xp_ganho, motivo, referencia_id, data_hora)
          VALUES
            (v_user.id, 50, 'Badge ' || v_badge.codigo || ' conquistado', v_event_id, NOW());
          
          -- Atualizar XP total do funcionário
          UPDATE user_service.funcionarios
          SET xp_total = COALESCE(xp_total, 0) + 50,
              nivel = CASE 
                WHEN COALESCE(xp_total, 0) + 50 >= 10000 THEN 'Lendário'
                WHEN COALESCE(xp_total, 0) + 50 >= 5000 THEN 'Expert'
                WHEN COALESCE(xp_total, 0) + 50 >= 3000 THEN 'Avançado'
                WHEN COALESCE(xp_total, 0) + 50 >= 1500 THEN 'Intermediário'
                WHEN COALESCE(xp_total, 0) + 50 >= 500 THEN 'Aprendiz'
                ELSE 'Iniciante'
              END
          WHERE id = v_user.id;
          
          RAISE NOTICE '   ✅ Badge conquistado: %', v_badge.nome;
          v_total_badges_awarded := v_total_badges_awarded + 1;
        END IF;
        
      END;
    END LOOP;
    
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '📊 RESUMO FINAL:';
  RAISE NOTICE '   Funcionários processados: %', v_total_users;
  RAISE NOTICE '   Total de badges atribuídos: %', v_total_badges_awarded;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Reavaliação concluída!';
  
END $$;

-- ============================================
-- ESTATÍSTICAS PÓS-REAVALIAÇÃO
-- ============================================

-- Total de badges conquistados por funcionário
SELECT 
  f.nome,
  COUNT(fb.badge_id) as total_badges,
  f.xp_total,
  f.nivel
FROM user_service.funcionarios f
LEFT JOIN gamification_service.funcionario_badges fb ON f.id = fb.funcionario_id
WHERE f.ativo = true
GROUP BY f.id, f.nome, f.xp_total, f.nivel
ORDER BY total_badges DESC, f.xp_total DESC
LIMIT 20;

-- Badges mais conquistados
SELECT 
  b.nome,
  b.codigo,
  COUNT(fb.funcionario_id) as total_conquistados
FROM gamification_service.badges b
LEFT JOIN gamification_service.funcionario_badges fb ON b.codigo = fb.badge_id
GROUP BY b.codigo, b.nome
ORDER BY total_conquistados DESC;

-- Funcionários sem badges
SELECT COUNT(*) as funcionarios_sem_badges
FROM user_service.funcionarios f
LEFT JOIN gamification_service.funcionario_badges fb ON f.id = fb.funcionario_id
WHERE f.ativo = true
AND fb.badge_id IS NULL;
