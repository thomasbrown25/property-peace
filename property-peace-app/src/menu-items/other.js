// assets
import BorderOutlined from '@ant-design/icons/BorderOutlined';
import BoxPlotOutlined from '@ant-design/icons/BoxPlotOutlined';
import DeploymentUnitOutlined from '@ant-design/icons/DeploymentUnitOutlined';
import GatewayOutlined from '@ant-design/icons/GatewayOutlined';
import MenuUnfoldOutlined from '@ant-design/icons/MenuUnfoldOutlined';
import QuestionOutlined from '@ant-design/icons/QuestionOutlined';
import SmileOutlined from '@ant-design/icons/SmileOutlined';
import StopOutlined from '@ant-design/icons/StopOutlined';

// icons
const icons = {
  BorderOutlined,
  BoxPlotOutlined,
  DeploymentUnitOutlined,
  GatewayOutlined,
  MenuUnfoldOutlined,
  QuestionOutlined,
  StopOutlined,
  SmileOutlined
};

// ==============================|| MENU ITEMS - SUPPORT ||============================== //

const other = {
  id: 'other',
  type: 'group',
  children: [
    {
      id: 'documentation',
      title: 'documentation',
      type: 'item',
      url: 'https://codedthemes.gitbook.io/mantis/',
      icon: icons.QuestionOutlined,
      external: true,
      target: true,
      chip: {
        label: 'gitbook',
        color: 'secondary',
        size: 'small'
      }
    }
  ]
};

export default other;
