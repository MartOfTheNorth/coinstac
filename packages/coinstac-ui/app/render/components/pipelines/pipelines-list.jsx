import React from 'react';
import { graphql } from 'react-apollo';
import { Alert, Button } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import PropTypes from 'prop-types';
import ListItem from '../common/list-item';
import { FETCH_ALL_PIPELINES_QUERY } from '../../state/graphql/functions';
import { pipelinesProp } from '../../state/graphql/props';

const PipelinesList = ({ pipelines }) => (
  <div>
    <div className="page-header clearfix">
      <h1 className="pull-left">Pipelines</h1>
      <LinkContainer className="pull-right" to="/dashboard/pipelines/new">
        <Button bsStyle="primary" className="pull-right">
          <span aria-hidden="true" className="glphicon glyphicon-plus" />
          {' '}
          Create Pipeline
        </Button>
      </LinkContainer>
    </div>
    {pipelines && pipelines.map(pipeline => (
      <ListItem
        key={`${pipeline.name}-list-item`}
        itemObject={pipeline}
        deleteItem={() => { return null; }}
        owner={false}
        itemOptions={[]}
        itemRoute={'/dashboard/pipelines'}
      />
    ))}
    {!pipelines &&
      <Alert bsStyle="info">
        No pipelines found
      </Alert>
    }
  </div>
);

PipelinesList.propTypes = {
  pipelines: PropTypes.array,
};

PipelinesList.defaultProps = {
  pipelines: null,
};

const PipelinesListWithData = graphql(FETCH_ALL_PIPELINES_QUERY, pipelinesProp)(PipelinesList);

export default PipelinesListWithData;