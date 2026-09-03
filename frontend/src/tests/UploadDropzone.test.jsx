import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UploadDropzone } from '../components/UploadDropzone';

describe('UploadDropzone', () => {
  it('renders the dropzone area and status cards for 3 files', () => {
    const onFilesReady = vi.fn();
    render(<UploadDropzone onFilesReady={onFilesReady} />);
    
    expect(screen.getByText(/Drag and drop your 3 CSV files here/i)).toBeInTheDocument();
    
    expect(screen.getByText('Bank')).toBeInTheDocument();
    expect(screen.getByText('Ledger')).toBeInTheDocument();
    expect(screen.getByText('Gateway')).toBeInTheDocument();
  });
});
