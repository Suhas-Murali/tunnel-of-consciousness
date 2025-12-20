import { useEffect } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { GetDashboardButton, HeaderPropsCommon } from "../components/bars";
import Editor from "../components/editor";
import { Breadcrumb } from "antd";

const ScriptPage = () => {
  const navigate = useNavigate();
  const { name } = useParams();
  console.log(name);
  const { isLoggedIn } = useOutletContext();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/auth/login");
    }
  }, [isLoggedIn, navigate]);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: 24,
      }}
    >
      <div style={{ flex: 1, overflow: "hidden" }}>
        <Editor documentName={name} />
      </div>
    </div>
  );
};

const GetHeaderProps = (context) => {
  return {
    ...HeaderPropsCommon,
    rightItems: [GetDashboardButton(context)],
    breadcrumbs: true,
  };
};

export const Script = {
  Page: ScriptPage,
  GetHeaderProps,
};
