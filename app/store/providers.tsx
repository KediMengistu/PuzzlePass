import { PropsWithChildren } from "react";
import { Provider } from "react-redux";

import { useAuthBootstrap } from "./listeners/use-auth-bootstrap";
import { store } from "./index";

function AuthBootstrapper({ children }: PropsWithChildren) {
  useAuthBootstrap();
  return children;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <AuthBootstrapper>{children}</AuthBootstrapper>
    </Provider>
  );
}
