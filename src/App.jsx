import { useState } from 'react'

/* ===========================================================================
   GEMINI INTEGRATION
   =========================================================================== */

const GEMINI_MODEL = 'gemini-2.0-flash'

const SYSTEM_PROMPT =
  'You are a smart cooking assistant. Based on available ingredients, budget, available cooking time, energy level, and diet preference, generate breakfast, lunch, dinner, cooking tasks, a grocery list, ingredient substitutions, and a budget analysis. Strictly respect the diet (Veg = no meat/fish/egg, Vegan = no animal products). Prefer ingredients the user already has. Keep recipes within the available time and match effort to the energy level. All money is in Indian Rupees (₹). Return ONLY JSON matching the schema.'

const MEAL = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    description: { type: 'STRING' },
    ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
    estimatedTime: { type: 'STRING' },
    estimatedCost: { type: 'STRING' },
  },
  required: ['name', 'description'],
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    breakfast: MEAL,
    lunch: MEAL,
    dinner: MEAL,
    todoList: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          step: { type: 'INTEGER' },
          task: { type: 'STRING' },
          duration: { type: 'STRING' },
        },
        required: ['step', 'task'],
      },
    },
    missingGroceries: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { item: { type: 'STRING' }, estimatedCost: { type: 'STRING' } },
        required: ['item'],
      },
    },
    substitutions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          ingredient: { type: 'STRING' },
          substitute: { type: 'STRING' },
          note: { type: 'STRING' },
        },
        required: ['ingredient', 'substitute'],
      },
    },
    budgetAnalysis: {
      type: 'OBJECT',
      properties: {
        feasible: { type: 'BOOLEAN' },
        budget: { type: 'STRING' },
        estimatedTotal: { type: 'STRING' },
        verdict: { type: 'STRING' },
        tips: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['feasible', 'verdict'],
    },
  },
  required: ['breakfast', 'lunch', 'dinner', 'todoList', 'missingGroceries', 'substitutions', 'budgetAnalysis'],
}

async function generateMealPlan({ ingredients, budget, time, energy, diet }, apiKey) {
  const key = (apiKey || import.meta.env.VITE_GEMINI_API_KEY || '').trim()
  if (!key) throw new Error('No Gemini API key. Set VITE_GEMINI_API_KEY in .env or paste a key in the form.')

  const prompt = `Plan a full day of meals.
Available ingredients: ${ingredients?.trim() || 'not specified'}
Budget: ${budget ? `₹${budget}` : 'not specified'}
Time per meal: ${time} minutes
Energy level: ${energy}
Diet: ${diet}

Return breakfast, lunch, dinner, a combined numbered cooking to-do list, missing grocery items with ₹ costs, ingredient substitutions, and a budget feasibility analysis vs ₹${budget || '—'} with money-saving tips. JSON only.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    },
  )

  if (!res.ok) {
    let msg = `Gemini API error (${res.status})`
    try {
      const e = await res.json()
      msg = e?.error?.message || msg
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }

  const data = await res.json()
  if (data?.promptFeedback?.blockReason) throw new Error(`Blocked by safety filters (${data.promptFeedback.blockReason}).`)
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty response from Gemini. Try again.')

  try {
    return JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0])
    throw new Error('Could not parse the meal plan. Try again.')
  }
}

/* ===========================================================================
   UI PRIMITIVES
   =========================================================================== */

const card = 'rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5'
const field =
  'w-full rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20'

function Label({ children }) {
  return <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400">{children}</label>
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
              value === o
                ? 'border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:text-white'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

const MEAL_META = {
  breakfast: { emoji: '🍳', label: 'Breakfast', ring: 'ring-amber-500/30', chip: 'bg-amber-500/15 text-amber-300' },
  lunch: { emoji: '🥗', label: 'Lunch', ring: 'ring-emerald-500/30', chip: 'bg-emerald-500/15 text-emerald-300' },
  dinner: { emoji: '🍽️', label: 'Dinner', ring: 'ring-violet-500/30', chip: 'bg-violet-500/15 text-violet-300' },
}

function MealCard({ type, meal }) {
  if (!meal) return null
  const m = MEAL_META[type]
  return (
    <div className={`h-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 ring-1 ${m.ring} transition hover:-translate-y-0.5 hover:bg-zinc-900`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{m.emoji}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${m.chip}`}>{m.label}</span>
      </div>
      <h3 className="mt-3 text-lg font-bold text-white">{meal.name}</h3>
      {meal.description && <p className="mt-1 text-sm leading-relaxed text-zinc-400">{meal.description}</p>}
      {Array.isArray(meal.ingredients) && meal.ingredients.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {meal.ingredients.map((i, k) => (
            <span key={k} className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{i}</span>
          ))}
        </div>
      )}
      {(meal.estimatedTime || meal.estimatedCost) && (
        <div className="mt-4 flex flex-wrap gap-3 border-t border-zinc-800 pt-3 text-xs text-zinc-400">
          {meal.estimatedTime && <span>⏱️ {meal.estimatedTime}</span>}
          {meal.estimatedCost && <span>💲 {meal.estimatedCost}</span>}
        </div>
      )}
    </div>
  )
}

function Section({ title, emoji, delay = 0, children }) {
  return (
    <section className={`animate-fade-in-up ${card}`} style={{ animationDelay: `${delay}ms` }}>
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
        <span className="text-xl">{emoji}</span> {title}
      </h2>
      {children}
    </section>
  )
}

function Results({ plan }) {
  const b = plan.budgetAnalysis || {}
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {['breakfast', 'lunch', 'dinner'].map((t, i) => (
          <div key={t} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
            <MealCard type={t} meal={plan[t]} />
          </div>
        ))}
      </div>

      <Section title="Cooking To-Do List" emoji="✅" delay={160}>
        {plan.todoList?.length ? (
          <ol className="space-y-2.5">
            {plan.todoList.map((t, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400">
                  {t.step ?? i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200">{t.task}</p>
                  {t.duration && <p className="mt-0.5 text-xs text-zinc-500">⏱️ {t.duration}</p>}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-zinc-500">No steps generated.</p>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Missing Grocery Items" emoji="🛒" delay={200}>
          {plan.missingGroceries?.length ? (
            <ul className="space-y-2">
              {plan.missingGroceries.map((g, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm text-zinc-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> {g.item}
                  </span>
                  {g.estimatedCost && <span className="shrink-0 rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">{g.estimatedCost}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">You have everything you need! 🎉</p>
          )}
        </Section>

        <Section title="Ingredient Substitutions" emoji="🔄" delay={240}>
          {plan.substitutions?.length ? (
            <ul className="space-y-2.5">
              {plan.substitutions.map((s, i) => (
                <li key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-rose-300">{s.ingredient}</span>
                    <span className="text-zinc-500">→</span>
                    <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-300">{s.substitute}</span>
                  </div>
                  {s.note && <p className="mt-1.5 text-xs text-zinc-500">{s.note}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No substitutions needed.</p>
          )}
        </Section>
      </div>

      <Section title="Budget Feasibility" emoji="💰" delay={280}>
        <div className={`flex items-center gap-3 rounded-xl border p-3 ${b.feasible ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/30 bg-rose-500/10'}`}>
          <span className="text-2xl">{b.feasible ? '✅' : '⚠️'}</span>
          <div>
            <p className={`text-sm font-semibold ${b.feasible ? 'text-emerald-300' : 'text-rose-300'}`}>{b.feasible ? 'Within budget' : 'Over budget'}</p>
            {b.verdict && <p className="text-xs text-zinc-400">{b.verdict}</p>}
          </div>
        </div>
        {(b.budget || b.estimatedTotal) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {b.budget && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <p className="text-xs text-zinc-500">Your budget</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{b.budget}</p>
              </div>
            )}
            {b.estimatedTotal && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <p className="text-xs text-zinc-500">Estimated cost</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{b.estimatedTotal}</p>
              </div>
            )}
          </div>
        )}
        {b.tips?.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {b.tips.map((t, i) => (
              <li key={i} className="flex gap-2 text-xs text-zinc-400">
                <span className="text-orange-400">💡</span> {t}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function Loader() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 p-12 text-center">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-zinc-800 border-t-orange-500" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">🍳</div>
      </div>
      <div className="mt-6 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-orange-400" style={{ animation: 'pulseDot 1.4s ease-in-out infinite', animationDelay: `${i * 0.16}s` }} />
        ))}
      </div>
      <p className="mt-4 text-sm font-medium text-zinc-300">Cooking up your meal plan…</p>
    </div>
  )
}

/* ===========================================================================
   APP
   =========================================================================== */

const TIMES = [15, 30, 45, 60]

export default function App() {
  const [form, setForm] = useState({
    ingredients: '',
    budget: '',
    time: '30',
    energy: 'Medium',
    diet: 'Veg',
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  })
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.ingredients.trim()) return setError('Please list at least a few ingredients you have at home.')
    setLoading(true)
    setPlan(null)
    try {
      setPlan(await generateMealPlan(form, form.apiKey))
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-[44rem] -translate-x-1/2 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <header className="mx-auto max-w-6xl px-4 pb-2 pt-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" /> Powered by Gemini AI
        </div>
        <h1 className="mt-4 bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
          🍳 Fridge-to-Meal AI
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400 sm:text-base">
          Turn whatever&apos;s in your fridge into a full day of meals — with a cooking checklist, grocery list and budget check.
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6">
        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* Form */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <form onSubmit={onSubmit} className={`${card} backdrop-blur`}>
              <h2 className="mb-1 text-lg font-bold text-white">What&apos;s in your kitchen?</h2>
              <p className="mb-5 text-sm text-zinc-400">Tell the AI what you&apos;ve got and it&apos;ll plan your day.</p>

              <div className="space-y-4">
                <div>
                  <Label>Available Ingredients</Label>
                  <textarea
                    rows={4}
                    value={form.ingredients}
                    onChange={(e) => set('ingredients', e.target.value)}
                    placeholder="e.g. eggs, rice, onions, tomatoes, paneer, milk, bread, garlic, spices…"
                    className={`${field} resize-none`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Budget</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">₹</span>
                      <input type="number" min="0" value={form.budget} onChange={(e) => set('budget', e.target.value)} placeholder="500" className={`${field} pl-7`} />
                    </div>
                  </div>
                  <div>
                    <Label>Time Available</Label>
                    <select value={form.time} onChange={(e) => set('time', e.target.value)} className={field}>
                      {TIMES.map((t) => (
                        <option key={t} value={t} className="bg-zinc-900">{t} min</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Segmented label="Energy Level" options={['Low', 'Medium', 'High']} value={form.energy} onChange={(v) => set('energy', v)} />
                <Segmented label="Diet Preference" options={['Veg', 'Non-Veg', 'Vegan']} value={form.diet} onChange={(v) => set('diet', v)} />

                <details className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                  <summary className="cursor-pointer select-none text-xs font-semibold text-zinc-400">Gemini API Key (optional override)</summary>
                  <input type="password" value={form.apiKey} onChange={(e) => set('apiKey', e.target.value)} placeholder="Paste a key, or set VITE_GEMINI_API_KEY in .env" className={`${field} mt-2 text-xs`} />
                </details>
              </div>

              <button type="submit" disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-400 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? 'Cooking…' : '✨ Generate Meal Plan'}
              </button>
            </form>
          </div>

          {/* Output */}
          <div className="min-w-0 space-y-6">
            {error && (
              <div className="animate-fade-in-up flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-rose-200">Something went wrong</p>
                  <p className="mt-0.5 text-sm text-rose-300/80">{error}</p>
                </div>
              </div>
            )}
            {loading && <Loader />}
            {!loading && !plan && !error && (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
                <div className="text-5xl">🥘</div>
                <h3 className="mt-4 text-lg font-bold text-white">Your meal plan will appear here</h3>
                <p className="mt-1 max-w-sm text-sm text-zinc-500">Add your ingredients and preferences, then hit Generate.</p>
              </div>
            )}
            {plan && !loading && <Results plan={plan} />}
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">React + Tailwind + Vite + Gemini</footer>
    </div>
  )
}
