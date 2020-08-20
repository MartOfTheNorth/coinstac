import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { compose, graphql, withApollo } from 'react-apollo';
import { ValidatorForm, TextValidator } from 'react-material-ui-form-validator';
import { trim } from 'lodash';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Typography from '@material-ui/core/Typography';
import { withStyles } from '@material-ui/core/styles';
import {
  CREATE_ISSUE_MUTATION,
} from '../../state/graphql/functions';
import {
  saveDocumentProp,
} from '../../state/graphql/props';
import { notifySuccess, notifyError } from '../../state/ducks/notifyAndLog';
import StatusButtonWrapper from '../common/status-button-wrapper';
import MarkdownValidator from './markdown-validator';

const styles = theme => ({
  tabTitleContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing(2),
  },
  textField: {
    marginTop: theme.spacing(2),
  },
  logs: {
    width: '100%',
    borderColor: theme.palette.grey[300],
    resize: 'none',
    minHeight: 500,
    fontSize: 13,
    padding: theme.spacing(1),
    '&:focus': {
      outline: 'none',
    },
  },
});

const issueTemplate = `**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Desktop (please complete the following information):**
 - OS: [e.g. Windows 10, OSX 11.15]
 - Version [eg 5.0.1] - in the very top menu got to Coinstac -> about 

**Additional context**
Add any other context about the problem here.
`;

const INITIAL_STATE = {
  title: '',
  content: issueTemplate,
  isOpenDialog: false,
  savingStatus: 'init',
};

class Issue extends Component {
  constructor(props) {
    super(props);

    this.state = {
      ...INITIAL_STATE,
      logs: '',
    };
  }

  handleChange = (name, value) => {
    this.setState({ [name]: value });
  }

  toggleDialog = () => {
    const { logs } = this.props;
    const { isOpenDialog } = this.state;
    this.setState({ isOpenDialog: !isOpenDialog, logs: logs.join('\n') });
  }

  handleSubmit = (includeLogs) => {
    const { title, content, logs } = this.state;
    const { createIssue, notifySuccess, notifyError } = this.props;

    this.setState({ savingStatus: 'pending', isOpenDialog: false });

    // eslint-disable-next-line prefer-template
    const body = includeLogs ? content + '\n**Logs**\n```' + logs + '```' : content;

    createIssue({ title: trim(title), body })
      .then(() => {
        this.setState({
          ...INITIAL_STATE,
          savingStatus: 'success',
        });
        notifySuccess('Issue is created on Github successfully');
        this.issueCreateForm.resetValidations();
      })
      .catch(() => {
        this.setState({ savingStatus: 'fail' });
        notifyError('Failed to create the issue on Github');
      });
  }

  render() {
    const { classes } = this.props;
    const {
      title, content, logs, isOpenDialog, savingStatus,
    } = this.state;

    return (
      <ValidatorForm
        instantValidate
        noValidate
        ref={(ref) => { this.issueCreateForm = ref; }}
        onSubmit={this.toggleDialog}
      >
        <div className={classes.tabTitleContainer}>
          <Typography variant="h5">
            Bug Report
          </Typography>
          <StatusButtonWrapper status={savingStatus}>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              disabled={savingStatus === 'pending'}
            >
              Save
            </Button>
          </StatusButtonWrapper>
        </div>
        <TextValidator
          id="title"
          label="Title"
          fullWidth
          value={title}
          name="name"
          required
          validators={['required']}
          errorMessages={['Bug report title is required']}
          className={classes.textField}
          withRequiredValidator
          onChange={evt => this.handleChange('title', evt.target.value)}
        />
        <MarkdownValidator
          id="content"
          label="Content"
          fullWidth
          value={content}
          required
          validators={['required']}
          errorMessages={['Bug report content is required']}
          className={classes.textField}
          withRequiredValidator
          onChange={content => this.handleChange('content', content)}
        />
        <Dialog
          open={isOpenDialog}
          maxWidth="md"
          fullWidth
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
          onClose={this.toggleDialog}
        >
          <DialogTitle id="alert-dialog-title">
            Do you agree to include logs with the issue?
          </DialogTitle>
          <DialogContent>
            <textarea
              id="alert-dialog-description"
              value={logs}
              className={classes.logs}
              onChange={evt => this.handleChange('logs', evt.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.handleSubmit(true)} color="primary" autoFocus>
              Yes
            </Button>
            <Button onClick={() => this.handleSubmit(false)} color="primary">
              No
            </Button>
            <Button onClick={this.toggleDialog} color="secondary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </ValidatorForm>
    );
  }
}

Issue.defaultProps = {
  logs: [],
};

Issue.propTypes = {
  createIssue: PropTypes.func.isRequired,
  notifySuccess: PropTypes.func.isRequired,
  notifyError: PropTypes.func.isRequired,
  classes: PropTypes.object.isRequired,
  logs: PropTypes.any,
};

const IssueWithData = compose(
  graphql(CREATE_ISSUE_MUTATION, saveDocumentProp('createIssue', 'issue')),
  withApollo
)(Issue);


const mapStateToProps = ({ app }) => ({
  logs: app.logs,
});

const connectedComponent = connect(mapStateToProps, {
  notifySuccess,
  notifyError,
})(IssueWithData);

export default withStyles(styles)(connectedComponent);
