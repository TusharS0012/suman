import { createBrowserRouter } from "react-router-dom";
import App from "../App.jsx";
import Body from "../components/Body";
import ConverterPage from "../components/ConverterPage";
import About from "../components/About";

const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: <Body />,
      },
      {
        path: "/converterPage",
        element: <ConverterPage />,
      },
      {
        path: "/about",
        element: <About />,
      },
    ],
  },
]);

export default appRouter;
