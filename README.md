# Agora Exam Suite

Build "Agora Quiz" — Ultra-Premium Production Quiz Platform



Build Agora Quiz, a bespoke, production-ready online examination platform designed to handle large numbers of simultaneous student attempts.



This is NOT a template dashboard, generic SaaS UI, or basic CRUD application. The final product must feel like a premium product designed by an elite product/design engineering team.



The application must prioritize:



- Premium visual design

- Extremely fast interaction

- Mobile-first responsiveness

- Reliable exam sessions

- Secure authentication and authorization

- Server-side exam integrity

- Scalable architecture

- Excellent accessibility

- Clean, maintainable code

- Production-ready error handling

- Zero unnecessary AI/API calls during student exams



---



1. CORE TECHNOLOGY



Use a modern production-grade stack:



- Next.js with TypeScript

- React

- Tailwind CSS

- Framer Motion

- Supabase

  - PostgreSQL

  - Authentication

  - Row Level Security

  - Storage where necessary

- React Hook Form where forms are required

- Zod for validation

- Lucide icons

- Inter or Geist typography



Use server-side logic/API routes/server actions wherever sensitive operations are involved.



Do NOT expose Supabase service-role credentials to the browser.



Do NOT expose answer keys, admin credentials, or privileged database operations to students.



---



2. VISUAL DESIGN SYSTEM



Agora Quiz must look like a premium technology product.



Color system



Primary:



- Pure black background

- Matte charcoal surfaces

- Deep graphite secondary surfaces

- Vibrant metallic/electric blue accent

- Subtle white/blue typography hierarchy



Use blue primarily for:



- Active states

- Primary CTAs

- Progress

- Selected answers

- Focus states

- Important interactive elements



Avoid excessive blue.



The design should feel expensive, restrained and intentional.



Glassmorphism



Use sophisticated Apple-inspired glass effects:



- backdrop blur

- translucent charcoal surfaces

- subtle borders

- low-opacity highlights

- soft blue ambient lighting



Avoid:



- giant shadows

- cheap gradients

- excessive glowing elements

- excessive rounded cards

- generic dashboard templates



Use soft radial blue ambient glows behind important active elements.



---



3. TYPOGRAPHY



Use Inter or Geist.



Create a consistent hierarchy:



- Display

- H1

- H2

- H3

- Body

- Caption

- Metadata



Typography should remain highly readable on mobile.



Do not use excessively thin text.



---



4. LANDING / ACCESS GATE



Create a cinematic landing page.



The uploaded hero image must be used prominently as the central visual element.



Structure:



                 AGORA QUIZ



          [ Hero / Splash Image ]



        Premium examination platform



      ┌─────────────────────────────┐

      │        ACCESS REQUIRED      │

      │                             │

      │  1. Join the Agora Channel  │

      │                             │

      │     [ Join Channel → ]      │

      │                             │

      │  2. Return here to continue │

      │                             │

      │       [ Start Quiz ]        │

      └─────────────────────────────┘



          Contact us: 08132927734



The exact composition can be refined aesthetically.



---



5. WHATSAPP GATE



The quiz requires students to visit a specified WhatsApp channel/group/community link before starting.



Button:



Join Channel



When clicked:



- Open the configured WhatsApp URL in a new tab.

- Record that the student initiated the channel visit.

- Change the interface state appropriately.

- When the student returns to the Agora Quiz tab, enable Start Quiz.



IMPORTANT:



Do not claim that the application can cryptographically prove that the student actually joined a WhatsApp group/channel unless the WhatsApp platform provides a supported verification mechanism.



The gate should therefore function as an access-flow requirement rather than falsely claiming verified WhatsApp membership.



Use:



- "localStorage" or session state for the UX state

- server-side session validation for actual exam access

- clear fallback behavior if the browser blocks the new tab



---



6. QUIZ ACCESS



Each quiz must have a unique public access link.



Example:



"/quiz/[quizSlug]"



or



"/quiz/[quizId]"



Do not expose sensitive database IDs unnecessarily.



A quiz should have:



- title

- slug

- description

- duration

- active/inactive status

- question limit

- leaderboard visibility

- created timestamp

- updated timestamp



If a quiz is inactive:



Display a premium inactive-state screen.



Example:



«This examination is currently unavailable.»



Do not expose admin information.



---



7. EXAM START FLOW



When Start Quiz is clicked:



1. Validate that the quiz exists.

2. Validate that the quiz is active.

3. Validate access conditions.

4. Create an exam session.

5. Fetch the required questions.

6. Store the question set locally for fast navigation.

7. Start the authoritative exam timer.

8. Enter exam mode.



Do not repeatedly request questions from the server while the student navigates.



---



8. ZERO-LAG EXAM ENGINE



The exam engine must feel instantaneous.



Maximum target:



180 questions per examination.



Fetch the student's exam question set once at the beginning.



Cache the non-sensitive question data locally.



Use:



- React state

- localStorage/IndexedDB where appropriate

- optimistic UI updates

- efficient React rendering



Do NOT reload the entire page when changing questions.



Do NOT show loading screens between questions.



Question navigation must feel instantaneous.



---



9. ANSWER SECURITY



Never send the correct answer to the browser during the exam.



The student client should receive:



- question

- options

- question metadata necessary for rendering



It should NOT receive:



- correct answer

- answer key

- hidden explanations containing the answer

- private grading information



The server must calculate the final score.



---



10. EXAM SESSION



Every attempt must have a unique exam session.



Create an exam-session record containing:



- session ID

- quiz ID

- start time

- authoritative expiry time

- submission time

- status

- score

- question-set version

- attempt metadata where appropriate



Possible statuses:



created

active

submitted

expired

cancelled



The server must be the authority for whether an exam has expired.



Do not trust the browser's timer.



---



11. TIMER



Display a beautiful digital countdown timer.



Example:



01:29:42



Timer behavior:



- synchronized against server time

- continues correctly after refresh

- warns the student near expiration

- automatically submits when time expires

- prevents extending the exam by manipulating browser time



Use subtle pulsing animation.



Do not create distracting animations.



---



12. EXAM HEADER



Sticky glassmorphic header.



Display:



- Agora Quiz logo

- Quiz title

- question progress

- visual progress bar

- remaining time



Example:



AGORA QUIZ        PHY 102



Question 37 / 180

████████░░░░░░░░░░░░



                    01:18:42



On small screens, intelligently collapse secondary information.



---



13. QUESTION UI



Display one question at a time.



Question area should be large and highly readable.



Options:



A   Option text



B   Option text



C   Option text



D   Option text



Each option must be a large block-level interactive element.



Selected option:



- blue border

- subtle blue background

- subtle ambient glow

- smooth transition



Use Framer Motion for micro-interactions.



Keyboard accessibility:



- A → select A

- B → select B

- C → select C

- D → select D

- Arrow navigation where appropriate



Do not make keyboard shortcuts interfere with normal typing.



---



14. NAVIGATION



Provide:



- Previous

- Next

- Submit Exam



Question navigation should be available through a compact question navigator.



Allow students to:



- see answered questions

- see unanswered questions

- jump to a question

- mark questions for review



Do not allow navigation controls to accidentally submit an exam.



---



15. AUTO-SAVE



Student answers must be saved continuously.



Use a hybrid approach:



Student selects answer

        ↓

Instant local state update

        ↓

Background server synchronization

        ↓

Database persistence



If the network temporarily disappears:



- keep the answer locally

- display a subtle connection state

- retry synchronization automatically

- prevent unnecessary data loss



When connection returns, reconcile local and server state safely.



---



16. REFRESH / RECONNECTION RECOVERY



If a student refreshes the page during an active exam:



Do NOT start a new attempt.



Recover the existing session.



Restore:



- current question

- selected answers

- timer

- marked questions

- exam progress



If the session has expired, show the appropriate expired/submission state.



---



17. SUBMISSION



When the student submits:



1. Confirm submission.

2. Lock the attempt.

3. Send answers to the server.

4. Server validates the session.

5. Server calculates score.

6. Server stores submission.

7. Server returns the permitted result data.

8. Client displays the result.



Prevent double submission.



If the student clicks Submit multiple times, only one submission should be accepted.



Use database-level protection/idempotency where appropriate.



---



18. AUTO-SUBMISSION



When the authoritative server-side exam deadline is reached:



Automatically finalize the attempt.



The server must treat the attempt as expired/submitted even if the browser is disconnected.



Do not rely exclusively on JavaScript timers.



---



19. RESULTS PAGE



Create a premium results experience.



Display:



EXAM COMPLETE



87 / 100



87%



Excellent performance.



Also display:



- total questions

- answered

- unanswered

- correct

- incorrect

- time used

- completion status



Use tasteful animation when the score appears.



---



20. QUESTION REVIEW



Display a review list containing:



- question

- student's selected answer

- correct answer

- explanation



Clearly distinguish:



- correct

- incorrect

- unanswered



Use collapsible sections to keep the page manageable for 180 questions.



Do not render all 180 expanded explanations simultaneously.



Use virtualization or progressive rendering where beneficial.



---



21. LEADERBOARD



Leaderboard must be hidden from students by default.



Quiz configuration:



Show Leaderboard: ON/OFF



If disabled:



- student cannot access leaderboard

- leaderboard data should not be unnecessarily exposed through the API



If enabled:



Display a premium ranking interface.



Avoid exposing sensitive student information.



---



22. ADMIN AUTHENTICATION



Create:



"/admin"



This route must be protected.



Unauthenticated users:



/admin → redirect → /



Students must NOT gain admin access merely by discovering the URL.



Implement:



- Supabase Authentication

- server-side session validation

- role-based authorization

- database Row Level Security

- admin role checks



Never rely solely on:



if (user.email === ...)



in client-side React code.



Never store admin secrets in frontend JavaScript.



---



23. ADMIN DASHBOARD



Create a completely different premium interface for administrators.



Navigation:



Overview

Quizzes

Questions

Submissions

Students

Analytics

Settings



Use a compact professional layout.



---



24. QUIZ MANAGEMENT



Admin can:



- create quiz

- edit quiz

- delete quiz

- duplicate quiz

- activate/deactivate quiz

- configure duration

- configure question count

- configure leaderboard visibility

- configure WhatsApp gate URL

- publish/unpublish quiz



Quiz status:



Draft

Active

Inactive

Archived



Use iOS-style toggles.



---



25. QUESTION MANAGEMENT



Admin can:



- create questions

- edit questions

- delete questions

- preview questions

- reorder questions

- assign topic

- assign difficulty

- assign explanation

- mark question as active/inactive



Question structure:



Question

Option A

Option B

Option C

Option D

Correct Answer

Explanation

Topic

Subtopic

Difficulty



---



26. BULK CSV IMPORT



Create a beautiful drag-and-drop uploader.



Accept:



".csv"



Target:



up to 180 questions per import.



Expected columns:



question

option_a

option_b

option_c

option_d

correct_answer

explanation

topic

subtopic

difficulty



Do not blindly insert uploaded data.



Pipeline:



Upload

 ↓

Parse

 ↓

Validate

 ↓

Preview

 ↓

Show errors

 ↓

Admin confirms

 ↓

Insert transactionally



Validation must detect:



- missing questions

- missing options

- invalid correct answer

- duplicate questions

- malformed CSV

- unsupported difficulty

- excessive question count

- empty explanations

- duplicate options

- invalid characters where relevant



Show row-specific errors.



Example:



Row 37

❌ correct_answer must be A, B, C, or D



Do not partially import a broken batch unless explicitly designed to do so.



---



27. QUESTION DUPLICATE DETECTION



Implement duplicate protection.



Detect:



- exact duplicates

- normalized duplicates

- highly similar questions where practical



Example:



"What is DNS?"

"What does DNS stand for?"



should be flagged as potentially related rather than blindly treated as completely unrelated.



Let the admin review flagged duplicates.



---



28. DATABASE



Create Supabase PostgreSQL tables for at minimum:



profiles



id

email

display_name

role

created_at

updated_at



Roles:



student

admin



quizzes



id

title

slug

description

duration_seconds

is_active

show_leaderboard

whatsapp_url

created_at

updated_at



questions



id

quiz_id

question_text

option_a

option_b

option_c

option_d

correct_answer

explanation

topic

subtopic

difficulty

position

is_active

created_at

updated_at



exam_sessions



id

quiz_id

student_id

started_at

expires_at

submitted_at

status

score

question_set_version

created_at

updated_at



submissions



id

session_id

quiz_id

student_id

score

percentage

correct_count

incorrect_count

unanswered_count

submitted_at



submission_answers



id

submission_id

question_id

selected_answer

is_correct

created_at



Add appropriate indexes and foreign keys.



---



29. DATABASE SECURITY



Use Supabase Row Level Security.



Students must only be able to access data belonging to their own permitted sessions/submissions.



Students must NEVER be allowed to directly query:



questions.correct_answer



during an active exam.



Sensitive grading operations should happen through secure server-side operations.



Admin-only tables/actions must require an authenticated admin role.



Test RLS policies explicitly.



---



30. SCALABILITY



The platform may be used by many students simultaneously.



Design for:



- hundreds of concurrent students

- potentially thousands of attempts

- 180-question exams

- frequent answer synchronization



Do NOT make an AI request for every question.



Do NOT make an AI request for every student.



Do NOT regenerate questions during an exam.



The question bank should already exist in PostgreSQL.



Normal student flow should be:



Student

 ↓

Quiz API

 ↓

PostgreSQL



not:



Student

 ↓

AI

 ↓

AI

 ↓

AI

 ↓

Question



AI should only be an optional administrative/content-generation tool.



---



31. PERFORMANCE



Optimize aggressively.



Requirements:



- fast initial load

- code splitting

- lazy loading

- optimized images

- minimal JavaScript

- efficient database queries

- indexed database columns

- no unnecessary API calls

- no repeated question fetching

- no unnecessary React re-renders



For 180-question exams, render only what is necessary.



Do not mount 180 complex question components simultaneously if avoidable.



---



32. ERROR HANDLING



Create polished error states for:



- quiz unavailable

- quiz expired

- network failure

- failed submission

- session recovery failure

- malformed CSV

- unauthorized admin access

- missing quiz

- database failure



Never expose raw database errors to students.



Example:



Instead of:



PostgrestError: relation xyz does not exist



display:



«Something went wrong while loading this examination. Please try again.»



Log technical details securely for administrators/developers.



---



33. RESPONSIVE DESIGN



The application must be excellent on:



- Android phones

- iPhones

- tablets

- laptops

- desktop monitors



Mobile exam experience is extremely important.



Buttons must be thumb-friendly.



Do not create tiny controls.



Question text must remain readable.



The timer must remain visible without consuming excessive screen space.



---



34. ACCESSIBILITY



Implement:



- semantic HTML

- keyboard navigation

- visible focus states

- accessible labels

- sufficient contrast

- screen-reader-friendly controls

- reduced-motion support



Respect:



"prefers-reduced-motion"



---



35. ANIMATIONS



Use Framer Motion.



Animations should feel:



- smooth

- subtle

- premium

- purposeful



Use animation for:



- page transitions

- question transitions

- selected answers

- progress updates

- result reveal

- modal transitions

- admin interactions



Never sacrifice performance for animation.



Avoid excessive bouncing or flashy effects.



---



36. SECURITY HARDENING



Implement protections against common web vulnerabilities.



At minimum consider:



- authentication bypass

- authorization bypass

- IDOR

- XSS

- CSRF where relevant

- SQL injection through unsafe database usage

- malicious CSV uploads

- session manipulation

- answer-key exposure

- duplicate submission

- replayed submission

- client-side score manipulation

- timer manipulation

- unauthorized leaderboard access

- rate abuse



Never trust:



- client score

- client timer

- client role

- client answer correctness

- client submission status



The server is authoritative.



---



37. ADMIN ANALYTICS



Create a premium analytics dashboard.



Show:



- total quizzes

- active quizzes

- total attempts

- average score

- highest score

- lowest score

- completion rate

- average completion time

- most difficult questions

- easiest questions

- topic performance

- question accuracy distribution



Allow filtering by quiz.



Use lightweight charts and avoid unnecessary visual clutter.



---



38. SUBMISSION ANALYTICS



Admin can inspect an individual attempt:



Student

Quiz

Score

Percentage

Started

Submitted

Duration

Correct

Incorrect

Unanswered



Then view the student's question-by-question responses.



Do not expose sensitive information unnecessarily.



---



39. DATA INTEGRITY



Use database constraints wherever possible.



Examples:



- valid foreign keys

- unique quiz slugs

- unique session IDs

- valid answer values

- valid role values

- valid session states



Use transactions for critical operations.



Especially:



- submission

- bulk question import

- quiz deletion

- session finalization



---



40. SEED DATA



Provide a small sample quiz so the application can be tested immediately.



Include realistic sample questions.



Clearly separate demo/sample content from production content.



---



41. ENVIRONMENT VARIABLES



Use environment variables.



Example:



NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY



Never commit secrets.



Create:



".env.example"



with placeholder values.



---



42. PROJECT STRUCTURE



Organize the application cleanly.



Example:



app/

  page.tsx

  quiz/

    [slug]/

  admin/

    page.tsx

    quizzes/

    questions/

    submissions/

    analytics/



components/

  quiz/

  admin/

  ui/



lib/

  supabase/

  auth/

  quiz/

  validation/



types/



Keep business logic separate from presentation components.



---



43. LOADING STATES



Use skeletons where loading genuinely occurs.



Do NOT display unnecessary loading screens.



During an active exam, navigation between already-loaded questions must never show a spinner.



---



44. EMPTY STATES



Create polished empty states.



Examples:



«No active examinations.»



«No submissions yet.»



«Your question bank is empty.»



Include useful actions for administrators.



---



45. FINAL QUALITY BAR



Before considering the application complete, test:



Student



- access quiz

- WhatsApp gate

- start exam

- select answers

- navigate

- mark questions

- refresh

- disconnect/reconnect

- submit

- auto-submit

- review results



Admin



- login

- unauthorized redirect

- create quiz

- activate quiz

- configure duration

- configure leaderboard

- upload CSV

- validation errors

- import questions

- edit questions

- delete questions

- inspect submissions

- analytics



Se

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://agora-quizmaster.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8b3a788d-3363-4361-adad-61e6dce14768).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
