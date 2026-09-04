export function ConvergenceDiagram() {
  return (
    <div className="constellation-container">
      <div className="constellation-header mono-text">MATCH CONSTELLATION</div>
      <div className="constellation-stage">
        {/* Background organic blob */}
        <svg
          className="constellation-blob"
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="var(--coral)"
            opacity="0.1"
            d="M45.7,-76.1C58.9,-69.3,69.2,-55.4,75.9,-40.8C82.6,-26.2,85.6,-10.8,83.9,4.2C82.2,19.2,75.8,33.8,66.1,45.4C56.4,57,43.4,65.6,29.3,71.1C15.2,76.6,0,79,-14.7,77.3C-29.4,75.6,-43.6,69.8,-55.8,60.2C-68,50.6,-78.2,37.2,-83.4,22.1C-88.6,7,-88.8,-9.8,-82.9,-24.5C-77,-39.2,-65,-51.8,-51.2,-59.1C-37.4,-66.4,-21.8,-68.4,-5.2,-61.8C11.4,-55.2,22.8,-40,45.7,-76.1Z"
            transform="translate(100 100) scale(1.1)"
          />
        </svg>

        {/* Dashed Connection Lines */}
        <svg className="constellation-lines" width="100%" height="100%">
          <line x1="20%" y1="20%" x2="50%" y2="50%" />
          <line x1="20%" y1="80%" x2="50%" y2="50%" />
          <line x1="80%" y1="50%" x2="50%" y2="50%" />
          
          <line x1="50%" y1="50%" x2="80%" y2="20%" />
          <line x1="50%" y1="50%" x2="80%" y2="80%" />
        </svg>

        {/* Nodes */}
        <div className="c-node node-1" style={{ top: '20%', left: '20%' }}>A</div>
        <div className="c-node node-2" style={{ top: '80%', left: '20%' }}>B</div>
        <div className="c-node node-3" style={{ top: '50%', left: '80%' }}>C</div>
        
        <div className="c-node node-4" style={{ top: '50%', left: '50%' }}>D</div>
        <div className="c-node node-5" style={{ top: '20%', left: '80%' }}>E</div>
        <div className="c-node node-6" style={{ top: '80%', left: '80%' }}>F</div>
      </div>
    </div>
  );
}
