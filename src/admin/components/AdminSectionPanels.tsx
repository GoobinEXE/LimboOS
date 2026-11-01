import React, { useState } from 'react';
import AdminTabPanel from './AdminTabPanel';

interface AdminSectionPanelsProps<S extends string> {
  active: S;
  render: (section: S) => React.ReactNode;
}

/**
 * Keep-alive das seções de um destino (Conteúdo, Mesa, Sistema): cada seção
 * visitada fica montada e oculta, então filtros, buscas e scroll interno
 * sobrevivem à troca de seção e ao Voltar.
 */
export default function AdminSectionPanels<S extends string>({ active, render }: AdminSectionPanelsProps<S>) {
  const [visited, setVisited] = useState<S[]>([active]);
  if (!visited.includes(active)) setVisited([...visited, active]);

  return (
    <>
      {visited.map((section) => (
        <AdminTabPanel key={section} active={section === active}>
          <div role="tabpanel">{render(section)}</div>
        </AdminTabPanel>
      ))}
    </>
  );
}
