import React from 'react';
import { Card, CardContent } from "@/components/shared/ui/card";
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
}

export default function StatCard({ label, value, icon: Icon, trend, color = "primary" }: StatCardProps) {
  return (
    <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
            <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
            
            {trend && (
              <div className="flex items-center gap-1 mt-2 text-xs font-semibold">
                <span className={trend.isPositive ? 'text-emerald-500' : 'text-rose-500'}>
                  {trend.isPositive ? '+' : '-'}{trend.value}%
                </span>
                <span className="text-slate-400 font-normal">desde el mes pasado</span>
              </div>
            )}
          </div>
          
          <div className={`p-4 rounded-2xl bg-${color}/10 text-${color}`}>
            <Icon size={24} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
