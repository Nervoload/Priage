import { useState } from 'react';

import { Mark } from '../shared/ui/Brand';
import { CtaButton } from '../shared/ui/Controls';
import { TextField } from '../shared/ui/Field';
import { FlowScreen } from '../shared/ui/FlowScreen';

interface DemoGatePageProps {
  onVerify: (code: string) => Promise<void>;
  error: string | null;
}

export function DemoGatePage({ onVerify, error }: DemoGatePageProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onVerify(code.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FlowScreen
      label="Access code"
      header={(
        <div className="brandbar">
          <span className="brand"><Mark /> Priage</span>
        </div>
      )}
      footer={(
        <CtaButton type="submit" form="demo-gate-form" busy={submitting} disabled={submitting || !code.trim()}>
          {submitting ? 'Checking…' : 'Continue'}
        </CtaButton>
      )}
    >
      <div className="stack stack--sm" style={{ paddingTop: 24 }}>
        <h1 className="display">Private preview</h1>
        <p className="lede">Enter the access code you were given to continue.</p>
      </div>
      <form id="demo-gate-form" className="form" onSubmit={handleSubmit}>
        <TextField
          label="Access code"
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          autoComplete="off"
          required
          error={error}
        />
      </form>
    </FlowScreen>
  );
}
