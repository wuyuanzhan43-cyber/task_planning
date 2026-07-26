export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  return <div className="modal-backdrop confirm-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="confirm-dialog" role="alertdialog" aria-modal="true"><h2>{request.title}</h2><p>{request.message}</p><footer><button className="text-button" onClick={onClose}>取消</button><button className={`primary-button ${request.danger ? "danger" : ""}`} autoFocus onClick={() => { request.onConfirm(); onClose(); }}>{request.confirmLabel ?? "确认"}</button></footer></div></div>;
}
