import type { SamplingMethod } from "@ratel/ts-bridges";
import { RequiredAttributeRulesEditor } from "@/components/space-actions/required-attribute-rules-editor";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useSpaceSamplingI18n } from "../i18n";
import type { UseSpaceSampling } from "../hooks/use-space-sampling";

/**
 * Sampling settings inputs, top to bottom: entry poll, population
 * conditions, sampling items, duplicate-prevention questions, sample size,
 * allocation (equal only), selection method and the
 * recruit-during-sampling option.
 */
export function SamplingSettingsForm({ sampling }: { sampling: UseSpaceSampling }) {
  const tr = useSpaceSamplingI18n();
  const t = useEnumI18n();
  const { form, setForm, locked, entryPolls, questions, candidates } = sampling;
  const entryTitle = entryPolls.find((p) => p.action_id === form.entryPollId)?.title ?? "";

  const toggleDimension = (index: number) => {
    const next = form.dimensions.includes(index) ? form.dimensions.filter((d) => d !== index) : [...form.dimensions, index];
    setForm({ dimensions: next });
  };

  const toggleUnique = (index: number) => {
    const next = form.uniqueQuestions.includes(index)
      ? form.uniqueQuestions.filter((d) => d !== index)
      : [...form.uniqueQuestions, index];
    setForm({ uniqueQuestions: next });
  };
  const hasShortAnswer = questions.some((q) => q.answer_type === "short_answer");

  const methods: { value: SamplingMethod; testId: string; hint: string }[] = [
    { value: "FirstCome", testId: "sampling-method-first-come", hint: tr.methodFirstComeHint },
    { value: "Random", testId: "sampling-method-random", hint: tr.methodRandomHint },
  ];

  return (
    <>
      <section className="spa-section" data-testid="sampling-section-entry-poll">
        <div className="spa-section__head">
          <div className="spa-section__title">
            <span className="spa-section__label">{tr.entryPollLabel}</span>
          </div>
          <span className="spa-section__hint">{tr.entryPollHint}</span>
        </div>
        {entryPolls.length === 0 ? (
          <div className="spa-warn" data-testid="sampling-no-entry-poll">
            {tr.noEntryPoll}
          </div>
        ) : entryPolls.length === 1 ? (
          <span className="sampling-readonly" data-testid="sampling-entry-poll-select">
            {entryTitle}
          </span>
        ) : (
          <select
            className="sampling-select"
            data-testid="sampling-entry-poll-select"
            value={form.entryPollId}
            disabled={locked}
            onChange={(e) => setForm({ entryPollId: e.currentTarget.value, rules: [], dimensions: [], uniqueQuestions: [] })}
          >
            <option value="" disabled>
              {tr.entryPollLabel}
            </option>
            {entryPolls.map((p) => (
              <option key={p.action_id} value={p.action_id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
      </section>

      <section className="spa-section sampling-section--raised" data-testid="sampling-section-population">
        <div className="spa-section__head">
          <div className="spa-section__title">
            <span className="spa-section__label">{tr.populationLabel}</span>
          </div>
        </div>
        <RequiredAttributeRulesEditor
          candidates={candidates}
          value={form.rules}
          onChange={(rules) => setForm({ rules })}
          disabled={locked}
          hint={tr.populationHint}
        />
      </section>

      <section className="spa-section" data-testid="sampling-section-dimensions">
        <div className="spa-section__head">
          <div className="spa-section__title">
            <span className="spa-section__label">{tr.dimensionsLabel}</span>
          </div>
          <span className="spa-section__hint">{tr.dimensionsHint}</span>
        </div>
        {candidates.length === 0 ? (
          <span className="spa-section__hint">{tr.noSingleChoice}</span>
        ) : (
          <div className="sampling-options">
            {questions.map((q, qi) =>
              q.answer_type === "single_choice" ? (
                <label key={qi} className="sampling-option">
                  <input
                    type="checkbox"
                    data-testid={`sampling-dimension-${qi}`}
                    checked={form.dimensions.includes(qi)}
                    disabled={locked}
                    onChange={() => toggleDimension(qi)}
                  />
                  <span>{q.title}</span>
                </label>
              ) : null,
            )}
          </div>
        )}
      </section>

      <section className="spa-section" data-testid="sampling-section-unique">
        <div className="spa-section__head">
          <div className="spa-section__title">
            <span className="spa-section__label">{tr.uniqueLabel}</span>
          </div>
          <span className="spa-section__hint">{tr.uniqueHint}</span>
        </div>
        {!hasShortAnswer ? (
          <span className="spa-section__hint" data-testid="sampling-no-short-answer">
            {tr.noShortAnswer}
          </span>
        ) : (
          <div className="sampling-options">
            {questions.map((q, qi) =>
              q.answer_type === "short_answer" ? (
                <label key={qi} className="sampling-option">
                  <input
                    type="checkbox"
                    data-testid={`sampling-unique-question-${qi}`}
                    checked={form.uniqueQuestions.includes(qi)}
                    disabled={locked}
                    onChange={() => toggleUnique(qi)}
                  />
                  <span>{q.title}</span>
                </label>
              ) : null,
            )}
          </div>
        )}
      </section>

      <section className="spa-section" data-testid="sampling-section-total">
        <div className="spa-section__head">
          <div className="spa-section__title">
            <span className="spa-section__label">{tr.totalLabel}</span>
          </div>
          <span className="spa-section__hint">{tr.totalHint}</span>
        </div>
        <div className="spa-quota-row">
          <input
            className="spa-quota-input"
            type="text"
            inputMode="numeric"
            data-testid="sampling-total-input"
            value={form.total}
            disabled={locked}
            onChange={(e) => setForm({ total: e.currentTarget.value.replace(/[^0-9]/g, "") })}
          />
        </div>
      </section>

      <section className="spa-section" data-testid="sampling-section-allocation">
        <div className="spa-section__head">
          <div className="spa-section__title">
            <span className="spa-section__label">{tr.allocationLabel}</span>
          </div>
        </div>
        <label className="sampling-option" data-testid="sampling-allocation-label">
          <input type="radio" name="sampling-allocation" data-testid="sampling-allocation-equal" checked readOnly disabled={locked} />
          <span>{tr.allocationLabel}</span>
        </label>
        <span className="spa-section__hint">{tr.allocationHint}</span>
      </section>

      <section className="spa-section" data-testid="sampling-section-method">
        <div className="spa-section__head">
          <div className="spa-section__title">
            <span className="spa-section__label">{tr.methodLabel}</span>
          </div>
        </div>
        <div className="sampling-options sampling-options--column">
          {methods.map((m) => (
            <label key={m.value} className="sampling-option">
              <input
                type="radio"
                name="sampling-method"
                data-testid={m.testId}
                checked={form.method === m.value}
                disabled={locked}
                onChange={() => setForm({ method: m.value })}
              />
              <span className="sampling-option__text">
                <strong>{t("SamplingMethod", m.value)}</strong>
                <span className="spa-section__hint">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="spa-section" data-testid="sampling-section-recruit">
        <div className="sampling-switch-row">
          <span className="sampling-option__text">
            <strong>{tr.recruitLabel}</strong>
            <span className="spa-section__hint">{tr.recruitHint}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={form.recruit}
            aria-label={tr.recruitLabel}
            className="sampling-switch"
            data-testid="sampling-recruit-toggle"
            disabled={locked}
            onClick={() => setForm({ recruit: !form.recruit })}
          >
            <span className="sampling-switch__thumb" />
          </button>
        </div>
      </section>
    </>
  );
}
