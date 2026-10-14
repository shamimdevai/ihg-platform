import CustomerHero from '@/components/customer/CustomerHero'
import MenuBrowse from '@/features/customer/menu/MenuBrowse'

export default function MenuPage() {
  return (
    <div>
      <CustomerHero
        title="Our menu"
        subtitle="Browse freely. Add items to your cart, and sign in when you're ready to order."
      />
      <MenuBrowse />
    </div>
  )
}