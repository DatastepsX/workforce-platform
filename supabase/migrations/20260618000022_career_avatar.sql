-- Career Avatar & Navigator
-- Extends candidate_profiles with avatar fields
-- New tables: soft_skill_ratings, career_ladders, career_ladder_steps,
--             candidate_career_paths, career_skill_gaps
-- Seeds 4 DACH career ladders

BEGIN;

-- ── 1. Extend candidate_profiles ─────────────────────────────────────────────
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS avatar_visible_to_recruiters boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS career_goals                 text,
  ADD COLUMN IF NOT EXISTS preferred_positions          text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_preferences             jsonb  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS strengths                    text,
  ADD COLUMN IF NOT EXISTS weaknesses                   text,
  ADD COLUMN IF NOT EXISTS motivation                   text,
  ADD COLUMN IF NOT EXISTS learning_willingness         smallint CHECK (learning_willingness BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS avatar_summary               text,
  ADD COLUMN IF NOT EXISTS avatar_generated_at          timestamptz,
  ADD COLUMN IF NOT EXISTS avatar_status                text NOT NULL DEFAULT 'none';
  -- avatar_status: 'none' | 'generating' | 'ready' | 'error'

-- ── 2. Soft skill ratings (self + AI) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS soft_skill_ratings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  skill                text NOT NULL,
  self_rating          smallint CHECK (self_rating BETWEEN 1 AND 5),
  ai_rating            smallint CHECK (ai_rating   BETWEEN 1 AND 5),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_profile_id, skill)
);

ALTER TABLE soft_skill_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ssr_candidate_own" ON soft_skill_ratings
  FOR ALL USING (candidate_profile_id = auth.uid());

CREATE POLICY "ssr_recruiter_read_visible" ON soft_skill_ratings
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('recruiter','admin','hiring_manager')
    AND (SELECT avatar_visible_to_recruiters FROM candidate_profiles
         WHERE id = soft_skill_ratings.candidate_profile_id)
  );

-- ── 3. Career ladders (admin-curated reference data) ─────────────────────────
CREATE TABLE IF NOT EXISTS career_ladders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  industry    text,
  description text,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE career_ladders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cl_read_all_auth"  ON career_ladders FOR SELECT TO authenticated USING (true);
CREATE POLICY "cl_write_admin_rec" ON career_ladders FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','recruiter'));

-- ── 4. Career ladder steps ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS career_ladder_steps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ladder_id       uuid NOT NULL REFERENCES career_ladders(id) ON DELETE CASCADE,
  position        smallint NOT NULL,
  title           text NOT NULL,
  required_skills text[] NOT NULL DEFAULT '{}',
  description     text,
  UNIQUE (ladder_id, position)
);

ALTER TABLE career_ladder_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cls_read_all_auth"   ON career_ladder_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "cls_write_admin_rec" ON career_ladder_steps FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','recruiter'));

-- ── 5. Candidate career paths (AI-personalized) ───────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_career_paths (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  base_ladder_id       uuid REFERENCES career_ladders(id),
  path_type            text NOT NULL DEFAULT 'ai_custom',
  title                text,
  summary              text,
  steps                jsonb NOT NULL DEFAULT '[]',
  generated_at         timestamptz NOT NULL DEFAULT now(),
  is_current           boolean NOT NULL DEFAULT true
);

ALTER TABLE candidate_career_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccp_candidate_own" ON candidate_career_paths
  FOR ALL USING (candidate_profile_id = auth.uid());

CREATE POLICY "ccp_recruiter_read_visible" ON candidate_career_paths
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('recruiter','admin','hiring_manager')
    AND (SELECT avatar_visible_to_recruiters FROM candidate_profiles
         WHERE id = candidate_career_paths.candidate_profile_id)
  );

-- ── 6. Career skill gaps per path step ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS career_skill_gaps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  career_path_id  uuid NOT NULL REFERENCES candidate_career_paths(id) ON DELETE CASCADE,
  step_position   smallint NOT NULL,
  missing_skills  text[] NOT NULL DEFAULT '{}',
  recommendations jsonb NOT NULL DEFAULT '[]',
  generated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE career_skill_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csg_candidate_own" ON career_skill_gaps FOR ALL
  USING (EXISTS (
    SELECT 1 FROM candidate_career_paths
    WHERE id = career_skill_gaps.career_path_id AND candidate_profile_id = auth.uid()
  ));

CREATE POLICY "csg_recruiter_read_visible" ON career_skill_gaps FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('recruiter','admin','hiring_manager')
    AND EXISTS (
      SELECT 1 FROM candidate_career_paths ccp
      JOIN candidate_profiles cp ON cp.id = ccp.candidate_profile_id
      WHERE ccp.id = career_skill_gaps.career_path_id AND cp.avatar_visible_to_recruiters = true
    )
  );

-- ── 7. Seed: 4 DACH career ladders ───────────────────────────────────────────
DO $$
DECLARE
  l1 uuid; l2 uuid; l3 uuid; l4 uuid;
BEGIN

  INSERT INTO career_ladders (name, industry, description)
    VALUES ('Software Engineering', 'IT / Technologie',
            'Klassische Entwicklerlaufbahn vom Berufseinsteiger bis zur technischen Führungskraft.')
    RETURNING id INTO l1;

  INSERT INTO career_ladder_steps (ladder_id, position, title, required_skills, description) VALUES
    (l1,1,'Junior Software Engineer',
      ARRAY['Git','HTML','CSS','JavaScript','Grundlagen OOP'],
      'Einstiegsposition unter Anleitung; erlernt Grundlagen und Best Practices.'),
    (l1,2,'Software Engineer',
      ARRAY['TypeScript','React','Node.js','SQL','REST APIs','Unit Testing'],
      'Eigenständige Umsetzung von Features, aktive Code-Reviews.'),
    (l1,3,'Senior Software Engineer',
      ARRAY['System Design','CI/CD','Docker','Performance Optimierung','Mentoring'],
      'Entwirft Komponenten, mentort Junioren, trägt zur Architektur bei.'),
    (l1,4,'Tech Lead',
      ARRAY['Architektur','Cloud','Teamführung','Agile','Stakeholder-Kommunikation'],
      'Technische Verantwortung für ein Team, Schnittstelle zu PM/Business.'),
    (l1,5,'Engineering Manager',
      ARRAY['People Management','OKRs','Hiring','Roadmap-Planung','Budgetverantwortung'],
      'Führt mehrere Teams, verantwortet Engineering-Strategie.');

  INSERT INTO career_ladders (name, industry, description)
    VALUES ('SAP Consulting', 'ERP / Unternehmensberatung',
            'Karrierepfad in der SAP-Beratung vom Analysten bis zum Principal Architect.')
    RETURNING id INTO l2;

  INSERT INTO career_ladder_steps (ladder_id, position, title, required_skills, description) VALUES
    (l2,1,'SAP Analyst',
      ARRAY['SAP Grundkenntnisse','Excel','ERP-Prozesse','Dokumentation'],
      'Einarbeitung in SAP-Module, unterstützt Consultants bei Projekten.'),
    (l2,2,'SAP Consultant',
      ARRAY['SAP S/4HANA','Customizing','ABAP Grundlagen','Projektmanagement'],
      'Eigenständige Durchführung von Implementierungsprojekten.'),
    (l2,3,'Senior SAP Consultant',
      ARRAY['S/4HANA Migration','SAP BTP','Integration PI/PO','Presales'],
      'Leitet Teilprojekte, berät Kunden auf strategischer Ebene.'),
    (l2,4,'SAP Solution Architect',
      ARRAY['Enterprise Architecture','SAP BTP Architektur','Multi-Cloud','Governance'],
      'Gesamtverantwortung für die technische Lösungsarchitektur.'),
    (l2,5,'Principal SAP Architect',
      ARRAY['SAP Strategie','Portfolio Management','C-Level Advisory','Innovation'],
      'Strategische SAP-Beratung auf Vorstandsebene.');

  INSERT INTO career_ladders (name, industry, description)
    VALUES ('Projektmanagement', 'Querschnittsfunktion',
            'Branchenübergreifender Karrierepfad im Projektmanagement.')
    RETURNING id INTO l3;

  INSERT INTO career_ladder_steps (ladder_id, position, title, required_skills, description) VALUES
    (l3,1,'Projektkoordinator',
      ARRAY['Jira','MS Project','Kommunikation','Protokollführung','Terminplanung'],
      'Unterstützt Projektleitung, koordiniert administrative Aufgaben.'),
    (l3,2,'Projektmanager',
      ARRAY['PMI / PRINCE2','Risikomanagement','Budgetkontrolle','Scrum','Stakeholder-Mgmt.'],
      'Eigenverantwortliche Leitung mittlerer Projekte.'),
    (l3,3,'Senior Projektmanager',
      ARRAY['Programm-Management','Change Management','Eskalationsmanagement','Coaching'],
      'Leitet komplexe internationale Projekte, mentort Junior PMs.'),
    (l3,4,'Programm-Manager',
      ARRAY['Strategische Planung','Business Case','Governance','Executive Reporting'],
      'Verantwortet mehrere voneinander abhängige Projekte.'),
    (l3,5,'PMO Director',
      ARRAY['PMO-Aufbau','KPI-Frameworks','Org.-Transformation','Board Reporting'],
      'Führt das Project Management Office, prägt Unternehmenskultur.');

  INSERT INTO career_ladders (name, industry, description)
    VALUES ('Data Science & Analytics', 'Technologie / Analytics',
            'Karrierepfad von der Datenanalyse bis zur KI-Architektur.')
    RETURNING id INTO l4;

  INSERT INTO career_ladder_steps (ladder_id, position, title, required_skills, description) VALUES
    (l4,1,'Data Analyst',
      ARRAY['SQL','Excel','Power BI','Tableau','Statistik','Python Pandas'],
      'Erstellt Reports, analysiert Datensätze, beantwortet Ad-hoc-Fragen.'),
    (l4,2,'Data Scientist',
      ARRAY['Python scikit-learn','Machine Learning','Feature Engineering','Statistik'],
      'Entwickelt und evaluiert Machine-Learning-Modelle.'),
    (l4,3,'Senior Data Scientist',
      ARRAY['Deep Learning','NLP','MLOps','AWS SageMaker','A/B Testing'],
      'Leitet ML-Projekte, definiert Metriken, mentort Analysten.'),
    (l4,4,'ML Engineer / AI Lead',
      ARRAY['Kubernetes','LLM Fine-Tuning','Feature Store','Modell-Deployment'],
      'Baut skalierbare ML-Plattformen; Schnittstelle Data Science/Engineering.'),
    (l4,5,'Head of Data / CDO',
      ARRAY['Datenstrategie','Data Governance','Budgetverantwortung','KI-Ethik'],
      'Strategische Verantwortung für die gesamte Datenfunktion.');

END $$;

COMMIT;
