import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RoleHint } from '../components/Shell';
import { ActionButton, Card, cx, Empty, fmtNum, UserLink, useMeUser } from '../components/ui';
import { bnCriteriaStatus, canStartTest, fmtDate, isNominator, lastApplication, startTest, submitTest, vouchesReceived } from '../engine';
import { useLab, useLabState } from '../store';

function Test({ appId }: { appId: string }) {
  const s = useLabState();
  const dispatch = useLab((st) => st.dispatch);
  const app = s.applications[appId];
  const [answers, setAnswers] = useState<number[]>(() => app.questionIds.map(() => -1));
  const qs = app.questionIds.map((id) => s.testQuestions.find((q) => q.id === id)!);
  const done = answers.filter((a) => a >= 0).length;
  return (
    <Card title={`BN test · ${qs.length} questions · pass mark ${Math.round(s.params.bnTest.passMark * 100)}%`}>
      <ol className="space-y-4">
        {qs.map((q, i) => (
          <li key={q.id}>
            <div className="mb-1.5 text-sm font-medium text-white">
              {i + 1}. {q.prompt}
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              {q.options.map((o, k) => (
                <label key={k} className={cx('flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-1.5 text-sm', answers[i] === k ? 'border-lab-pink bg-lab-pink/10' : 'border-ink-600 hover:bg-ink-800')}>
                  <input type="radio" className="mt-1" name={q.id} checked={answers[i] === k} onChange={() => setAnswers((a) => a.map((x, j) => (j === i ? k : x)))} />
                  {o}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm muted">
          {done}/{qs.length} answered
        </span>
        <button className="btn-primary" onClick={() => dispatch(submitTest, { applicationId: app.id, answers })}>
          Submit test
        </button>
      </div>
    </Card>
  );
}

function Result({ appId }: { appId: string }) {
  const s = useLabState();
  const app = s.applications[appId];
  const qs = app.questionIds.map((id) => s.testQuestions.find((q) => q.id === id)!);
  const passed = app.status === 'passed';
  return (
    <Card title={passed ? 'Passed: you are now a BN' : 'Not passed this time'} className={passed ? 'border-lab-mint/40' : 'border-lab-red/40'}>
      <div className={cx('mb-3 text-3xl font-bold', passed ? 'text-lab-mint' : 'text-lab-red')}>{Math.round((app.testScore ?? 0) * 100)}%</div>
      {passed ? (
        <p className="mb-3 text-sm">
          You start with {s.params.newBnAllowance} nomination and an empty directory profile. <Link to="/bn">Open the BN dashboard →</Link>
        </p>
      ) : (
        <p className="mb-3 text-sm muted">You can retry {s.params.bnTest.retryDays} days after this attempt.</p>
      )}
      <ol className="space-y-2">
        {qs.map((q, i) => {
          const right = app.answers?.[i] === q.correctIndex;
          return (
            <li key={q.id} className="rounded-lg bg-ink-850 p-2 text-sm">
              <div className="font-medium text-white">
                <span className={right ? 'text-lab-mint' : 'text-lab-red'}>{right ? '✓' : '✗'}</span> {q.prompt}
              </div>
              {!right && <div className="text-xs text-lab-red">Your answer: {q.options[app.answers?.[i] ?? 0]}</div>}
              <div className="text-xs muted">
                Correct: {q.options[q.correctIndex]}. {q.explanation}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export function BNApplyPage() {
  const s = useLabState();
  const me = useMeUser();
  const dispatch = useLab((st) => st.dispatch);
  const criteria = bnCriteriaStatus(s, me.id);
  const vouches = vouchesReceived(s, me.id);
  const app = lastApplication(s, me.id);
  const already = isNominator(me);
  return (
    <div className="space-y-4">
      <h1 className="h1">Become a Beatmap Nominator</h1>
      <RoleHint
        hints={{
          player: 'Meet any one criterion below to unlock the test. There is no activity requirement once you are a BN.',
          bn: 'You are already a BN. You can vouch for aspiring BNs from their profile pages.',
        }}
      />
      {me.isAdmin && <Empty>The admin persona can't apply. Try AlmostThere or aimgod_77.</Empty>}
      {!me.isAdmin && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Card title="Criteria (any one)">
              <ul className="space-y-2">
                {criteria.map((c) => (
                  <li key={c.key} className={cx('flex items-center justify-between gap-3 rounded-lg px-3 py-2', c.met ? 'bg-lab-mint/10' : 'bg-ink-850')}>
                    <span className="flex items-center gap-2 text-sm">
                      <span className={c.met ? 'text-lab-mint' : 'text-slate-600'}>{c.met ? '●' : '○'}</span>
                      {c.label}
                    </span>
                    <span className={cx('font-mono text-sm', c.met ? 'text-lab-mint' : 'text-slate-300')}>
                      {typeof c.value === 'boolean' ? (c.value ? 'yes' : 'no') : `${fmtNum(c.value)} / ${fmtNum(c.threshold as number)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            {already ? (
              app && (app.status === 'passed' ? <Result appId={app.id} /> : <Empty>You are already a BN.</Empty>)
            ) : app?.status === 'in_test' ? (
              <Test key={app.id} appId={app.id} />
            ) : (
              <>
                {app && <Result appId={app.id} />}
                <Card title="BN test">
                  <p className="mb-3 text-sm muted">
                    {s.params.bnTest.questions} multiple-choice questions drawn from a bank of {s.testQuestions.length} (fictional ranking criteria). Pass mark {Math.round(s.params.bnTest.passMark * 100)}%. Failed applicants can retry after {s.params.bnTest.retryDays} days.
                  </p>
                  <ActionButton check={canStartTest(s, me.id)} onClick={() => dispatch(startTest, {})}>
                    Start the test
                  </ActionButton>
                </Card>
              </>
            )}
          </div>
          <Card title={`Vouches received (${vouches.length})`}>
            {vouches.length ? (
              <ul className="space-y-1.5 text-sm">
                {vouches.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2">
                    <UserLink id={v.voucherId} />
                    <span className="text-xs muted">{fmtDate(v.at)}{!isNominator(s.users[v.voucherId]) && ' · no longer BN'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm muted">No vouches yet. Current BNs can vouch for one user every {s.params.vouchCooldownDays} days from that user's profile.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
