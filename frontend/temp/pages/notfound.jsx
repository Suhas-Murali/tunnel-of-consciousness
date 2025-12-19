import { Button, Result } from "antd";
import { useNavigate } from "react-router-dom";
import {
  GetDashboardButton,
  GetLoginButton,
  GetSignupButton,
  HeaderPropsCommon,
} from "../components/bars";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      <Result
        status="404"
        title="404"
        subTitle="Sorry, the page you visited does not exist."
        extra={
          <Button type="primary" onClick={() => navigate("/")}>
            Back Home
          </Button>
        }
      />
    </div>
  );
};

const GetHeaderProps = (context) => {
  return {
    ...HeaderPropsCommon,
    rightItems: context.isLoggedIn
      ? [GetDashboardButton(context)]
      : [GetLoginButton(context), GetSignupButton(context)],
  };
};

export const NotFound = {
  Page: NotFoundPage,
  GetHeaderProps,
};
