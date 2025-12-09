import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import "./App.css";
import Header from "./components/Header";
import Footer from "./components/Footer";

const LoadingSpinner = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "200px",
    }}
  >
    <div>Loading...</div>
  </div>
);

function App() {
  return (
    <>
      <Header />
      <main>
        <Suspense fallback={<LoadingSpinner />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

export default App;
