import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AuditTable } from '../components/AuditTable';

describe('AuditTable', () => {
  it('renders the table and data', () => {
    const mockData = [
      {
        decided_at: '2026-09-02T10:00:00Z',
        reason_code: 'MATCHED',
        group_key: 'KEY_1',
        involved_sources: [{ source: 'bank', source_ref_id: 'B1' }]
      }
    ];

    render(<AuditTable data={mockData} />);
    
    // Check headers
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Rule')).toBeInTheDocument();
    expect(screen.getByText('Group Key')).toBeInTheDocument();
    
    // Check data cells
    expect(screen.getByText('KEY_1')).toBeInTheDocument();
    expect(screen.getByText(/B1/)).toBeInTheDocument();
  });
});
