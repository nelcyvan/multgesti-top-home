// home/multgesti/src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Route, Switch, useHistory, useLocation } from "react-router-dom";
import LoginComponent from './components/acesso/Login';
import Dashboard from './pages/dashboard/Dashboard';
import PermissaoGesLOG from './components/acesso/PermissaoGesLOG';
import PermissaoZapHub from './components/acesso/PermissaoZapHub';
import PermissaoGestPRO from './components/acesso/PermissaoGestPRO';
import PermissaoOFXConcilia from './components/acesso/PermissaoOFXConcilia';
import PermissaoGestFIN from './components/acesso/PermissaoGestFIN';
import GestLOG from './pages/gestlog/GestLOG';
import OfxConcilia from './pages/ofxconcilia/OfxConcilia';
import Gestpro from './pages/gestpro/Gestpro';
import Gestfin from './pages/gestfin/Gestfin';
import Gestmkt from './pages/gestmkt/Gestmkt';
import Gestoper from './pages/gestoper/Gestoper';
import Gestvendas from './pages/gestvendas/Gestvendas';
import PermissaoGestMKT from './components/acesso/PermissaoGestMKT';
import ChatHub from './pages/zaphub/ChatHub';

const App: React.FC = () => {
  return (
    <Router>
      <IdleRedirect />
      <Switch>
        <Route exact path="/" component={LoginComponent} />
        <Route exact path="/dashboard" component={Dashboard} />
        <Route exact path="/gestlog/permissao" component={PermissaoGesLOG} />
        <Route exact path="/gestlog" component={GestLOG} />
        <Route exact path="/zaphub/permissao" component={PermissaoZapHub} />
        <Route exact path="/zaphub" component={ChatHub} />
        <Route exact path="/gestpro/permissao" component={PermissaoGestPRO} />
        <Route exact path="/gestpro" component={Gestpro} />
        <Route exact path="/gestoper" component={Gestoper} />
        <Route exact path="/gestvendas" component={Gestvendas} />
        <Route exact path="/gestfin/permissao" component={PermissaoGestFIN} />
        <Route exact path="/gestfin" component={Gestfin} />
        <Route exact path="/ofxconcilia/permissao" component={PermissaoOFXConcilia} />
        <Route exact path="/ofxconcilia" component={OfxConcilia} />
        <Route exact path="/gestmkt/permissao" component={PermissaoGestMKT} />
        <Route exact path="/gestmkt" component={Gestmkt} />
      </Switch>
    </Router>
  );
}

export default App;

const IdleRedirect: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const redirect = () => {
      if (location.pathname !== "/") history.replace("/");
    };
    const reset = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(redirect, 1800000);
    };
    const events = [
      "mousemove",
      "mousedown",
      "keypress",
      "scroll",
      "touchstart",
      "touchmove",
      "click",
    ];
    events.forEach((e) => window.addEventListener(e, reset, true));
    reset();
    return () => {
      if (timer !== null) clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset, true));
    };
  }, [history, location.pathname]);
  return null;
};
