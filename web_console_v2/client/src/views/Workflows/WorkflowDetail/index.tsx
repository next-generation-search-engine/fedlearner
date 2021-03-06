import React, { FC, useState } from 'react';
import styled from 'styled-components';
import { Card, Spin, Row, Button } from 'antd';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { getPeerWorkflowsConfig, getWorkflowDetailById } from 'services/workflow';
import WorkflowJobsFlowChart from 'components/WorkflowJobsFlowChart';
import { useTranslation } from 'react-i18next';
import WhichProject from 'components/WhichProject';
import WorkflowActions from '../WorkflowActions';
import WorkflowStage from '../WorkflowList/WorkflowStage';
import GridRow from 'components/_base/GridRow';
import BreadcrumbLink from 'components/BreadcrumbLink';
import CountTime from 'components/CountTime';
import JobExecutionDetailsDrawer from './JobExecutionDetailsDrawer';
import { useToggle } from 'react-use';
import { JobNode, NodeData, NodeDataRaw } from 'components/WorkflowJobsFlowChart/types';
import { useMarkFederatedJobs } from 'components/WorkflowJobsFlowChart/hooks';
import PropertyList from 'components/PropertyList';
import { Eye, EyeInvisible } from 'components/IconPark';
import { WorkflowExecutionDetails } from 'typings/workflow';
import { ReactFlowProvider } from 'react-flow-renderer';
import { isRunning, isStopped } from 'shared/workflow';
import dayjs from 'dayjs';
import NoResult from 'components/NoResult';
import { Job, JobExecutionDetalis } from 'typings/job';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: var(--contentHeight);
`;
const ChartSection = styled.section`
  display: flex;
  margin-top: 12px;
  flex: 1;
`;
const ChartContainer = styled.div`
  height: 100%;
  flex: 1;

  & + & {
    margin-left: 16px;
  }
`;
const HeaderRow = styled(Row)`
  margin-bottom: 30px;
`;
const Name = styled.h3`
  margin-bottom: 0;
  font-size: 20px;
  line-height: 28px;
`;
// TODO: find a better way to define no-result's container
const NoJobs = styled.div`
  display: flex;
  height: calc(100% - 48px);
  background-color: var(--gray1);
`;
const ChartHeader = styled(Row)`
  height: 48px;
  padding: 0 20px;
  font-size: 14px;
  line-height: 22px;
  background-color: white;
`;
const ChartTitle = styled.h3`
  margin-bottom: 0;

  &::after {
    margin-left: 25px;
    content: attr(data-note);
    font-size: 12px;
    color: var(--darkGray6);
  }
`;

const WorkflowDetail: FC = () => {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const [peerJobsVisible, togglePeerJobsVisible] = useToggle(false);
  const [drawerVisible, toggleDrawerVisible] = useToggle(false);
  const [isPeerSide, setIsPeerSide] = useState(false);
  const [data, setData] = useState<NodeData>();

  const detailQuery = useQuery(
    ['getWorkflowDetailById', params.id],
    () => getWorkflowDetailById(params.id),
    { cacheTime: 1 },
  );
  const peerWorkflowQuery = useQuery(['getPeerWorkflow', params.id], getPeerWorkflow, {
    retry: false,
  });

  const { markThem } = useMarkFederatedJobs();

  const workflow = detailQuery.data?.data;
  const transactionErr = workflow?.transaction_err;

  let isRunning_ = false;
  let isStopped_ = false;

  let runningTime: number = 0;

  if (workflow) {
    isRunning_ = isRunning(workflow);
    isStopped_ = isStopped(workflow);

    if (isRunning_ || isStopped_) {
      const { stop_at, start_at } = workflow;
      runningTime = isStopped_ ? stop_at! - start_at! : dayjs().unix() - start_at!;
    }
  }

  const workflowProps = [
    {
      label: t('workflow.label_template_name'),
      value: workflow?.config?.group_alias || (
        <Link to={`/workflows/accept/basic/${workflow?.id}`}>{t('workflow.job_node_pending')}</Link>
      ),
    },
    {
      label: t('workflow.label_project'),
      value: <WhichProject id={workflow?.project_id || 0} />,
    },
    {
      label: t('workflow.label_running_time'),

      value: workflow && <CountTime time={runningTime} isStatic={!isRunning_} />,
    },
    // Display workflow global variables
    ...(workflow?.config?.variables || []).map((item) => ({ label: item.name, value: item.value })),
  ];

  const jobsWithExeDetails = mergeJobDefsWithExecutionDetails(workflow);
  const peerJobsWithExeDetails = mergeJobDefsWithExecutionDetails(peerWorkflowQuery.data);

  markThem(jobsWithExeDetails, peerJobsWithExeDetails);

  return (
    <Spin spinning={detailQuery.isLoading}>
      <Container>
        <BreadcrumbLink
          paths={[
            { label: 'menu.label_workflow', to: '/workflows' },
            { label: 'workflow.execution_detail' },
          ]}
        />
        <Card>
          <HeaderRow justify="space-between" align="middle">
            <GridRow gap="8">
              <Name>{workflow?.name}</Name>
              {workflow && <WorkflowStage workflow={workflow} tag />}
            </GridRow>
            {workflow && (
              <WorkflowActions
                workflow={workflow}
                without={['detail']}
                onSuccess={detailQuery.refetch}
              />
            )}
          </HeaderRow>

          {/* i.e. Workflow execution error  */}
          {transactionErr && <p>{transactionErr}</p>}

          <PropertyList
            labelWidth={100}
            initialVisibleRows={3}
            cols={3}
            properties={workflowProps}
          />
        </Card>

        <ChartSection>
          {/* Our config */}
          <ChartContainer>
            <ChartHeader justify="space-between" align="middle">
              <ChartTitle data-note={peerJobsVisible ? t('workflow.federated_note') : ''}>
                {t('workflow.our_config')}
              </ChartTitle>

              {!peerJobsVisible && (
                <Button icon={<Eye />} onClick={() => togglePeerJobsVisible(true)}>
                  {t('workflow.btn_see_peer_config')}
                </Button>
              )}
            </ChartHeader>

            {jobsWithExeDetails.length === 0 ? (
              <NoJobs>
                <NoResult
                  text={t('workflow.msg_not_config')}
                  CTAText={t('workflow.action_configure')}
                  to={`/workflows/accept/basic/${params.id}`}
                />
              </NoJobs>
            ) : (
              <ReactFlowProvider>
                <WorkflowJobsFlowChart
                  nodeType="execution"
                  workflowConfig={{
                    ...workflow?.config!,
                    job_definitions: jobsWithExeDetails,
                    variables: [],
                  }}
                  onJobClick={viewJobDetail}
                  onCanvasClick={() => toggleDrawerVisible(false)}
                />
              </ReactFlowProvider>
            )}
          </ChartContainer>

          {/* Peer config */}
          {peerJobsVisible && (
            <ChartContainer>
              <ChartHeader justify="space-between" align="middle">
                <ChartTitle data-note={peerJobsVisible ? t('workflow.federated_note') : ''}>
                  {t('workflow.peer_config')}
                </ChartTitle>

                <Button icon={<EyeInvisible />} onClick={() => togglePeerJobsVisible(false)}>
                  {t('workflow.btn_hide_peer_config')}
                </Button>
              </ChartHeader>

              {peerJobsWithExeDetails.length === 0 ? (
                <NoJobs>
                  <NoResult text={t('workflow.msg_peer_not_ready')} />
                </NoJobs>
              ) : (
                <ReactFlowProvider>
                  <WorkflowJobsFlowChart
                    nodeType="execution"
                    workflowConfig={{
                      ...peerWorkflowQuery.data?.config!,
                      job_definitions: peerJobsWithExeDetails,
                      variables: [],
                    }}
                    onJobClick={viewPeerJobDetail}
                    onCanvasClick={() => toggleDrawerVisible(false)}
                  />
                </ReactFlowProvider>
              )}
            </ChartContainer>
          )}
        </ChartSection>

        <JobExecutionDetailsDrawer
          visible={drawerVisible}
          toggleVisible={toggleDrawerVisible}
          jobData={data}
          workflow={detailQuery.data?.data}
          isPeerSide={isPeerSide}
        />
      </Container>
    </Spin>
  );

  function viewJobDetail(jobNode: JobNode) {
    setIsPeerSide(false);
    showJobDetailesDrawer(jobNode);
  }

  function viewPeerJobDetail(jobNode: JobNode) {
    setIsPeerSide(true);
    showJobDetailesDrawer(jobNode);
  }
  function showJobDetailesDrawer(jobNode: JobNode) {
    setData(jobNode.data);
    toggleDrawerVisible(true);
  }
  async function getPeerWorkflow() {
    const res = await getPeerWorkflowsConfig(params.id);
    const anyPeerWorkflow = Object.values(res.data).find((item) => !!item.config)!;

    return anyPeerWorkflow;
  }
};

function mergeJobDefsWithExecutionDetails(
  workflow: WorkflowExecutionDetails | undefined,
): NodeDataRaw[] {
  if (!workflow) return [];

  return (
    workflow.config?.job_definitions.map((item) => {
      return Object.assign(item, workflow?.jobs?.find(_matcher(workflow, item)) || {}, {
        name: item.name,
      });
    }) || []
  );
  // TODO: find a better way to distinguish job-def-name and job-execution-name
  function _matcher(workflow: WorkflowExecutionDetails, jobDef: Job) {
    return (job: JobExecutionDetalis) => {
      return job.name === `${workflow.name}-${jobDef.name}` || job.name.endsWith(jobDef.name);
    };
  }
}

export default WorkflowDetail;
