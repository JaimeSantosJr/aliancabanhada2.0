import { AdminRoot } from './admin-root'
import './admin.css'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminRoot>{children}</AdminRoot>
}
