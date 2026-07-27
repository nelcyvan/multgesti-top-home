import React from 'react';
import VisualizarPedidoModal from './modals/VisualizarPedidoModal';
import type { 
  VisualizarPedidoModalProps, 
  PedidoDetalhe, 
  PedidoItem, 
  PedidoResumo 
} from './modals/VisualizarPedidoModal';

export type { PedidoDetalhe, PedidoItem, PedidoResumo };

const VisualizarPedido: React.FC<VisualizarPedidoModalProps> = (props) => {
  return <VisualizarPedidoModal {...props} />;
};

export default VisualizarPedido;
