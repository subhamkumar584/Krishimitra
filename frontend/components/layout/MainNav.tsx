"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Home, 
  ShoppingCart, 
  Package, 
  Plus, 
  BarChart3, 
  User, 
  LogOut, 
  Menu, 
  X,
  Leaf
} from 'lucide-react';

import { getCurrentUser } from '../../lib/api';
import LanguageSelector from '../ui/LanguageSelector';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'farmer' | 'customer' | 'admin' | 'equipmetal';
}

export default function MainNav() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (err) {
        console.error('Failed to fetch user:', err);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('km_auth');
    setUser(null);
    router.push('/auth/login');
  };

  const roleConfig = {
    farmer: {
      name: 'Farmer',
      emoji: '🌱',
      color: 'text-green-400',
      links: [
        { href: '/', label: 'Home', icon: Home },
        { href: '/marketplace', label: 'Marketplace', icon: ShoppingCart },
        { href: '/farmer/products', label: 'My Products', icon: Package },
        { href: '/farmer/products/new', label: 'Sell Product', icon: Plus },
        { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      ]
    },
    customer: {
      name: 'Customer',
      emoji: '🛒',
      color: 'text-blue-400',
      links: [
        { href: '/marketplace', label: 'Marketplace', icon: ShoppingCart },
      ]
    },
    admin: {
      name: 'Admin',
      emoji: '⚡',
      color: 'text-purple-400',
      links: [
        { href: '/', label: 'Home', icon: Home },
        { href: '/marketplace', label: 'Marketplace', icon: ShoppingCart },
        { href: '/admin/users', label: 'Users', icon: User },
        { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      ]
    },
    equipmetal: {
      name: 'Fertilizer and Machineary',
      emoji: '🧰',
      color: 'text-amber-400',
      links: [
        { href: '/marketplace', label: 'Marketplace', icon: ShoppingCart },
      ]
    }
  };

  if (isLoading) {
    return (
      <nav className="bg-[color:var(--card)] border-b border-[color:var(--border)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center animate-pulse">
              <div className="h-8 w-32 bg-[color:var(--muted)] rounded"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  if (!user) {
    return (
      <nav className="bg-[color:var(--card)] border-b border-[color:var(--border)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <Leaf className="w-8 h-8 text-[color:var(--primary)]" />
              <span className="text-xl font-bold text-[color:var(--foreground)]">
                KrishiMitra
              </span>
            </Link>

            {/* Auth Links */}
            <div className="flex items-center space-x-4">
              <LanguageSelector />
              <Link 
                href="/auth/login"
                className="text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)] transition-colors"
              >
                Login
              </Link>
              <Link 
                href="/auth/register"
                className="bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-4 py-2 rounded-lg hover:opacity-90 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const config = (roleConfig as any)[user.role] || roleConfig.customer;

  return (
    <nav className="bg-[color:var(--card)] border-b border-[color:var(--border)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Leaf className="w-8 h-8 text-[color:var(--primary)]" />
            <span className="text-xl font-bold text-[color:var(--foreground)]">
              KrishiMitra
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {config.links.map((link) => {
              const IconComponent = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center space-x-2 text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)] transition-colors"
                >
                  <IconComponent className="w-4 h-4" />
                  <span className="text-sm font-medium">{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {/* Language Selector */}
            <LanguageSelector />
            
            {/* Role Badge */}
            <div className={`hidden sm:flex items-center space-x-2 ${config.color} bg-[color:var(--muted)] px-3 py-1 rounded-full text-sm font-medium`}>
              <span>{config.emoji}</span>
              <span>{config.name}</span>
            </div>

            {/* User Profile */}
            <div className="relative group">
              <button className="flex items-center space-x-2 text-[color:var(--foreground)] hover:text-[color:var(--foreground)]/80 transition-colors">
                <User className="w-5 h-5" />
                <span className="hidden sm:inline text-sm">{user.name}</span>
              </button>

              {/* Dropdown */}
              <div className="absolute right-0 mt-2 w-48 bg-[color:var(--card)] border border-[color:var(--border)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="py-1">
                  <div className="px-4 py-2 border-b border-[color:var(--border)]">
                    <p className="text-sm font-medium text-[color:var(--foreground)]">{user.name}</p>
                    <p className="text-xs text-[color:var(--foreground)]/60">{user.email}</p>
                  </div>
                  
                  <Link
                    href="/profile"
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-[color:var(--foreground)]/70 hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </Link>
                  
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-[color:var(--foreground)] hover:text-[color:var(--foreground)]/80 transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-[color:var(--border)]">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {config.links.map((link) => {
                const IconComponent = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center space-x-3 px-3 py-2 text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)] hover:bg-[color:var(--muted)] rounded-lg transition-colors"
                  >
                    <IconComponent className="w-5 h-5" />
                    <span className="font-medium">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}