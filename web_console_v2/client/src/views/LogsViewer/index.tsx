import React, { FC } from 'react';
import { Route } from 'react-router-dom';
import styled from 'styled-components';
import PodLogs from './PodLogs';
import JobLogs from './JobLogs';

const Container = styled.main`
  padding-left: 10px;
  height: 100vh;
  background-color: #292238;
`;
const LogsViewer: FC = () => {
  return (
    <Container>
      <Route path="/logs/pod/:jobid/:podname" exact component={PodLogs} />
      <Route path="/logs/job/:jobname" exact component={JobLogs} />
    </Container>
  );
};

export default LogsViewer;
