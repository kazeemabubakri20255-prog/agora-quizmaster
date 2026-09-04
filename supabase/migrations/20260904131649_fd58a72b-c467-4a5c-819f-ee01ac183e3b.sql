
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('student','admin');
CREATE TYPE public.quiz_status AS ENUM ('draft','active','inactive','archived');
CREATE TYPE public.session_status AS ENUM ('created','active','submitted','expired','cancelled');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- new user -> profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- QUIZZES
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 3600 CHECK (duration_seconds BETWEEN 60 AND 43200),
  question_limit INTEGER NOT NULL DEFAULT 20 CHECK (question_limit BETWEEN 1 AND 180),
  status public.quiz_status NOT NULL DEFAULT 'draft',
  is_active BOOLEAN NOT NULL DEFAULT false,
  show_leaderboard BOOLEAN NOT NULL DEFAULT false,
  shuffle_questions BOOLEAN NOT NULL DEFAULT true,
  whatsapp_url TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read quizzes" ON public.quizzes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_quizzes_updated BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_quizzes_slug ON public.quizzes(slug);

-- QUESTIONS
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
  explanation TEXT,
  topic TEXT,
  subtopic TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  position INTEGER NOT NULL DEFAULT 0,
  normalized_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: answer keys are only reachable server-side.
CREATE TRIGGER trg_questions_updated BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_questions_quiz ON public.questions(quiz_id, position);
CREATE INDEX idx_questions_norm ON public.questions(quiz_id, normalized_text);

-- EXAM SESSIONS
CREATE TABLE public.exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  student_identifier TEXT,
  session_token UUID NOT NULL DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  status public.session_status NOT NULL DEFAULT 'created',
  score INTEGER,
  question_ids UUID[] NOT NULL DEFAULT '{}',
  question_set_version INTEGER NOT NULL DEFAULT 1,
  current_index INTEGER NOT NULL DEFAULT 0,
  marked_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.exam_sessions TO service_role;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON public.exam_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_sessions_quiz ON public.exam_sessions(quiz_id, status);
CREATE INDEX idx_sessions_expiry ON public.exam_sessions(status, expires_at);

-- SESSION ANSWERS (autosave)
CREATE TABLE public.session_answers (
  session_id UUID NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_answer CHAR(1) CHECK (selected_answer IN ('A','B','C','D')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, question_id)
);
GRANT ALL ON public.session_answers TO service_role;
ALTER TABLE public.session_answers ENABLE ROW LEVEL SECURITY;

-- SUBMISSIONS
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  unanswered_count INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  auto_submitted BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_submissions_quiz ON public.submissions(quiz_id, score DESC);

-- SUBMISSION ANSWERS
CREATE TABLE public.submission_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_answer CHAR(1) CHECK (selected_answer IN ('A','B','C','D')),
  is_correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submission_id, question_id)
);
GRANT ALL ON public.submission_answers TO service_role;
ALTER TABLE public.submission_answers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sub_answers_q ON public.submission_answers(question_id, is_correct);

-- SEED DEMO QUIZ
INSERT INTO public.quizzes (id, title, slug, description, duration_seconds, question_limit, status, is_active, show_leaderboard, whatsapp_url, is_demo)
VALUES ('11111111-1111-4111-8111-111111111111','PHY 102 — Demo Examination','phy-102-demo','A short sample examination demonstrating the Agora Quiz engine.',1800,10,'active',true,true,'https://whatsapp.com/channel/',true);

INSERT INTO public.questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, topic, subtopic, difficulty, position, normalized_text) VALUES
('11111111-1111-4111-8111-111111111111','What is the SI unit of electric current?','Volt','Ampere','Ohm','Watt','B','The ampere (A) is the SI base unit of electric current.','Electricity','Units','easy',1,'what is the si unit of electric current'),
('11111111-1111-4111-8111-111111111111','Which law states that the current through a conductor is proportional to the voltage across it?','Ohm''s law','Faraday''s law','Lenz''s law','Coulomb''s law','A','Ohm''s law: V = IR for an ohmic conductor at constant temperature.','Electricity','Circuits','easy',2,'which law states that the current through a conductor is proportional to the voltage across it'),
('11111111-1111-4111-8111-111111111111','The equivalent resistance of two 4 ohm resistors in parallel is:','8 ohm','4 ohm','2 ohm','1 ohm','C','For equal resistors in parallel, R_eq = R/2 = 2 ohm.','Electricity','Circuits','medium',3,'the equivalent resistance of two 4 ohm resistors in parallel is'),
('11111111-1111-4111-8111-111111111111','Which particle carries a negative charge?','Proton','Neutron','Electron','Positron','C','Electrons carry a charge of -1.6 x 10^-19 C.','Atomic','Particles','easy',4,'which particle carries a negative charge'),
('11111111-1111-4111-8111-111111111111','The capacitance of a parallel plate capacitor increases when:','Plate separation increases','Plate area increases','Charge decreases','Voltage increases','B','C = εA/d, so capacitance rises with plate area.','Electricity','Capacitance','medium',5,'the capacitance of a parallel plate capacitor increases when'),
('11111111-1111-4111-8111-111111111111','Magnetic flux is measured in:','Tesla','Weber','Henry','Gauss','B','The weber (Wb) is the SI unit of magnetic flux.','Magnetism','Units','easy',6,'magnetic flux is measured in'),
('11111111-1111-4111-8111-111111111111','A step-down transformer has:','More turns in the secondary','Equal turns','Fewer turns in the secondary','No core','C','A step-down transformer has fewer secondary turns, lowering the output voltage.','Magnetism','Induction','medium',7,'a step down transformer has'),
('11111111-1111-4111-8111-111111111111','The time constant of an RC circuit is given by:','R/C','RC','C/R','1/RC','B','τ = RC, with units of seconds.','Electricity','Transients','medium',8,'the time constant of an rc circuit is given by'),
('11111111-1111-4111-8111-111111111111','Which of these is a vector quantity?','Speed','Energy','Momentum','Temperature','C','Momentum has both magnitude and direction.','Mechanics','Vectors','easy',9,'which of these is a vector quantity'),
('11111111-1111-4111-8111-111111111111','Photoelectric emission supports the:','Wave nature of light','Particle nature of light','Ether theory','Doppler effect','B','Photoelectric emission is explained by light quanta (photons).','Modern Physics','Quantum','hard',10,'photoelectric emission supports the');
