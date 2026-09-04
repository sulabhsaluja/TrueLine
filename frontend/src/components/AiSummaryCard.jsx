export function AiSummaryCard({ narrative, error, isPending = false }) {
  // If there's an error, we label the source as FALLBACK, else GROQ
  const sourceLabel = error ? 'SOURCE: FALLBACK' : 'SOURCE: GROQ';

  return (
    <div className="controller-note">
      <div className="note-header">
        <span className="note-title">CONTROLLER NOTE</span>
        <span className="note-source">{sourceLabel}</span>
      </div>
      
      <div className="note-body mono-text">
        {isPending ? (
          'Waiting for readout...'
        ) : error ? (
          <>
            <span className="coral">Summary unavailable:</span> {error}
          </>
        ) : narrative ? (
          narrative
        ) : (
          <span className="muted">No summary was generated for this run.</span>
        )}
      </div>

      <div className="note-footer">
        <span className="note-arrow">-------&gt;</span>
      </div>
    </div>
  );
}
