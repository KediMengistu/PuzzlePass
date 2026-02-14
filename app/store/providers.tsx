import { PropsWithChildren } from "react";
import { Provider } from "react-redux";

import { useAuthBootstrap } from "./listeners/use-auth-bootstrap";
import { useStoreBootstrap } from "./listeners/use-store-bootstrap";
import { store } from "./index";

function AuthBootstrapper({ children }: PropsWithChildren) {
  useAuthBootstrap();
  useStoreBootstrap();
  return children;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <AuthBootstrapper>{children}</AuthBootstrapper>
    </Provider>
  );
}
