import React from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { BoxSeam } from "react-bootstrap-icons";

type Props = {
  count: number;
  onClick: () => void;
  selected?: boolean;
};

const PedidosColetaSeparadaSidebarIcon: React.FC<Props> = ({ count, onClick, selected }) => {
  return (
    <OverlayTrigger
      placement="left"
      trigger={["hover", "focus"]}
      overlay={<Tooltip id="gestpro-tooltip-coleta-separada">Pedidos Coleta Separada</Tooltip>}
    >
      <span className="gestpro-sidebar-icon-wrap">
        <button
          type="button"
          className={`nav-link gestpro-sidebar-icon position-relative ${selected ? "bg-success text-white" : count > 0 ? "active" : "text-muted"}`}
          onClick={onClick}
          aria-label="Pedidos Coleta Separada"
        >
          <BoxSeam size={18} />
          {count > 0 && (
            <span
              className="position-absolute badge rounded-pill bg-danger"
              style={{ top: 2, left: 2, fontSize: "0.65rem", lineHeight: 1, zIndex: 1 }}
            >
              {count}
            </span>
          )}
        </button>
      </span>
    </OverlayTrigger>
  );
};

export default PedidosColetaSeparadaSidebarIcon;
