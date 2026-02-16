import type { LiveInstance } from '../types';
import instanceIcon from '../assets/PM Instance Icon.svg';
import './LiveInstances.css';

function InstanceCard({ instance }: { instance: LiveInstance }) {
  const isConnected = instance.status === 'connected';

  return (
    <div className="instance-card">
      <img src={instanceIcon} alt="" className="instance-icon" />
      <div className="instance-info">
        <span className="instance-device">{instance.device}</span>
        <span className="instance-location">{instance.location}</span>
      </div>
      <div className={`instance-badge ${isConnected ? 'badge-connected' : 'badge-disconnected'}`}>
        <span className="badge-dot" />
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
    </div>
  );
}

export function LiveInstances({ instances }: { instances: LiveInstance[] }) {
  return (
    <div className="live-instances">
      <h2 className="section-title">Live Instances</h2>
      <div className="instances-list">
        {instances.map((inst) => (
          <InstanceCard key={inst.id} instance={inst} />
        ))}
      </div>
    </div>
  );
}
